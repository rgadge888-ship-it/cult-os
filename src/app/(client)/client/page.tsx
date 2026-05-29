import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { parseNumber, parseDateRange } from "@/lib/reports/parse";
import type { WeeklyReport, WeeklyReportData } from "@/lib/db/types";

type ScheduleEvent = { tag: string; date: Date; raw: string };
type Snapshot = {
  // Current / upcoming webinar
  currentTag: string | null;
  currentDate: string | null;
  cohortStart: string | null; // day after the previous webinar
  cohortDays: number;
  leadsForCurrent: number;
  totalLeads: number;
  cohortSpend: number | null;
  cpl: number | null;
  // Daily ad spend (last 7 calendar days)
  dailySpend: { date: string; spend: number; raw: string }[];
  // Tag for the "This Week" report band
  reportTags: string[];
};

function parseDdMmYyyy(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadSnapshot(
  fileId: string | null,
  reportRange: { start: string; end: string } | null,
): Promise<Snapshot> {
  const empty: Snapshot = {
    currentTag: null,
    currentDate: null,
    cohortStart: null,
    cohortDays: 0,
    leadsForCurrent: 0,
    totalLeads: 0,
    cohortSpend: null,
    cpl: null,
    dailySpend: [],
    reportTags: [],
  };
  if (!fileId) return empty;

  try {
    const meta = await getSheetMetadataAsAgency(fileId);
    const titles = meta.tabs.map((t) => t.title);
    const scheduleTab = titles.find((t) => /schedule|internal sheet/i.test(t));
    const leadsTab = titles.find((t) => /leadsheet|^leads$/i.test(t));
    const dailyTab = titles.find((t) => /daily/i.test(t));

    const [sched, leads, daily] = await Promise.all([
      scheduleTab
        ? getSheetValuesAsAgency(fileId, `'${scheduleTab}'!A1:Z200`, { formatted: true })
        : Promise.resolve([] as string[][]),
      leadsTab
        ? getSheetValuesAsAgency(fileId, `'${leadsTab}'!A1:Z3000`, { formatted: true })
        : Promise.resolve([] as string[][]),
      dailyTab
        ? getSheetValuesAsAgency(fileId, `'${dailyTab}'!A1:Z60`, { formatted: true })
        : Promise.resolve([] as string[][]),
    ]);

    // --- Schedule: parse all events, find current + previous ---
    const events: ScheduleEvent[] = [];
    if (sched.length > 1) {
      const head = sched[0].map((h) => h.toLowerCase());
      const iTag = head.findIndex((h) => h.includes("workshop tag") || h.includes("tag"));
      const iDate = head.findIndex((h) => h.includes("workshop date") || h.includes("date"));
      if (iTag >= 0 && iDate >= 0) {
        for (const r of sched.slice(1)) {
          const tag = (r[iTag] ?? "").toString().trim();
          const dateStr = (r[iDate] ?? "").toString().trim();
          const d = parseDdMmYyyy(dateStr);
          if (tag && d) events.push({ tag, date: d, raw: dateStr });
        }
        events.sort((a, b) => a.date.getTime() - b.date.getTime());
      }
    }

    const todayMs = (() => {
      const t = new Date();
      t.setUTCHours(23, 59, 59, 999);
      return t.getTime();
    })();

    // Upcoming = first event with date >= today (no time component); fallback to latest.
    const upcomingIdx = (() => {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const i = events.findIndex((e) => e.date.getTime() >= startOfToday.getTime());
      if (i >= 0) return i;
      return events.length - 1;
    })();
    const upcoming = upcomingIdx >= 0 ? events[upcomingIdx] : null;
    const prior = upcomingIdx > 0 ? events[upcomingIdx - 1] : null;

    // Cohort window: day after the previous webinar through today (or
    // upcoming date, whichever is earlier).
    const cohortStartMs = prior
      ? prior.date.getTime() + 24 * 3600 * 1000
      : null;
    const cohortEndMs = Math.min(
      todayMs,
      upcoming ? upcoming.date.getTime() + 24 * 3600 * 1000 - 1 : todayMs,
    );
    const cohortDays = cohortStartMs
      ? Math.max(0, Math.round((cohortEndMs - cohortStartMs) / (24 * 3600 * 1000)) + 1)
      : 0;

    // --- Leads: count by current tag ---
    let leadsForCurrent = 0;
    let totalLeads = 0;
    if (leads.length > 1 && upcoming) {
      const head = leads[0].map((h) => h.toLowerCase());
      const iTag = head.findIndex((h) => h.includes("webinar tag") || h.includes("tag"));
      const dataRows = leads.slice(1).filter((r) => r.some((c) => (c ?? "").trim() !== ""));
      totalLeads = dataRows.length;
      if (iTag >= 0) {
        leadsForCurrent = dataRows.filter(
          (r) => (r[iTag] ?? "").toString().trim() === upcoming.tag,
        ).length;
      }
    } else if (leads.length > 1) {
      totalLeads = leads.slice(1).filter((r) => r.some((c) => (c ?? "").trim() !== "")).length;
    }

    // --- Daily spend (parse Date column, filter to past, take last 7) ---
    type DailyRow = { label: string; iso: string; spend: number; raw: string };
    const parsedDaily: DailyRow[] = [];
    if (daily.length > 1) {
      const head = daily[0].map((h) => h.toLowerCase());
      const iDate = head.findIndex((h) => h === "date" || h.startsWith("date"));
      const iSpend = head.findIndex(
        (h) => h === "with gst" || h === "ad spend" || h === "spend",
      );
      if (iDate >= 0 && iSpend >= 0) {
        for (const r of daily.slice(1)) {
          const label = (r[iDate] ?? "").toString().trim();
          if (!label) continue;
          const dr = parseDateRange(label);
          if (!dr) continue;
          const raw = (r[iSpend] ?? "").toString().trim();
          parsedDaily.push({
            label,
            iso: dr.start,
            spend: parseNumber(raw) ?? 0,
            raw,
          });
        }
      }
    }
    const todayIso = new Date().toISOString().slice(0, 10);
    parsedDaily.sort((a, b) => a.iso.localeCompare(b.iso));
    const pastOnly = parsedDaily.filter((r) => r.iso <= todayIso);
    const dailySpend = pastOnly
      .slice(-7)
      .map((r) => ({ date: r.label, spend: r.spend, raw: r.raw }));

    // --- Cohort spend: sum daily spend within the cohort window ---
    let cohortSpend: number | null = null;
    let cohortStartIso: string | null = null;
    if (cohortStartMs != null) {
      const startIso = new Date(cohortStartMs).toISOString().slice(0, 10);
      const endIso = new Date(cohortEndMs).toISOString().slice(0, 10);
      cohortStartIso = startIso;
      const inWindow = pastOnly.filter((r) => r.iso >= startIso && r.iso <= endIso);
      cohortSpend = inWindow.reduce((s, r) => s + r.spend, 0);
    }
    const cpl =
      cohortSpend != null && leadsForCurrent > 0
        ? cohortSpend / leadsForCurrent
        : null;

    // --- Report tags: which webinar(s) fall in the published report's range ---
    const reportTags: string[] = [];
    if (reportRange) {
      const startMs = new Date(reportRange.start + "T00:00:00Z").getTime();
      const endMs = new Date(reportRange.end + "T23:59:59Z").getTime();
      for (const e of events) {
        const t = e.date.getTime();
        if (t >= startMs && t <= endMs) reportTags.push(e.tag);
      }
    }

    return {
      currentTag: upcoming?.tag ?? null,
      currentDate: upcoming?.raw ?? null,
      cohortStart: cohortStartIso,
      cohortDays,
      leadsForCurrent,
      totalLeads,
      cohortSpend,
      cpl,
      dailySpend,
      reportTags,
    };
  } catch {
    return empty;
  }
}

export default async function ClientDashboardPage() {
  const { profile, client } = await getCurrentClientContext();
  const supabase = await createClient();

  const [{ count: total }, { count: done }, { data: latest }] = await Promise.all([
    supabase.from("deliverables").select("*", { count: "exact", head: true }),
    supabase
      .from("deliverables")
      .select("*", { count: "exact", head: true })
      .eq("status", "done"),
    supabase
      .from("weekly_reports")
      .select("id, week_start_date, week_end_date, data")
      .eq("status", "published")
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestReport = latest as
    | (Pick<WeeklyReport, "id" | "week_start_date" | "week_end_date"> & {
        data: WeeklyReportData;
      })
    | null;

  const snapshot = await loadSnapshot(
    client?.mainsheet_file_id ?? null,
    latestReport
      ? { start: latestReport.week_start_date, end: latestReport.week_end_date }
      : null,
  );

  const pct = total ? Math.round(((done ?? 0) / total) * 100) : 0;
  const m = latestReport?.data.current.metrics;

  // Target CPL — for now we use the latest report's CPR as the reference target.
  const targetCpl = m?.cost_per_acq?.value ?? null;
  const onTrack =
    snapshot.cpl != null && targetCpl != null ? snapshot.cpl <= targetCpl * 1.2 : null;

  const maxSpend = Math.max(1, ...snapshot.dailySpend.map((d) => d.spend));

  const inr = (n: number) =>
    "₹" +
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      Math.round(Math.abs(n)),
    );

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► snapshot
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Hello, {profile.full_name ?? profile.email.split("@")[0]}.
        </h1>
        <p className="text-sm text-zinc-500">
          your funnel · your reports · your progress
        </p>
      </div>

      {/* Top KPIs from latest published report */}
      <div className="mt-8">
        <SectionHeader
          label="this week"
          className="mb-3"
          action={
            latestReport ? (
              <Link
                href={`/client/reports/${latestReport.id}`}
                className="font-mono text-[10px] uppercase tracking-widest text-orange-400 hover:text-orange-300"
              >
                full report →
              </Link>
            ) : null
          }
        />
        {latestReport && m ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="ROAS" value={m.roas?.raw} accent />
            <Kpi label="Revenue" value={m.revenue?.raw} />
            <Kpi label="Net P/L" value={m.net_profit?.raw} />
            <Kpi label="Ad Spend" value={m.spend_with_gst?.raw} />
          </div>
        ) : (
          <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
            No report published yet. Your team will publish one after your next weekly
            call.
          </Panel>
        )}
        {latestReport ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            week {latestReport.week_start_date} → {latestReport.week_end_date}
            {snapshot.reportTags.length > 0 ? (
              <span className="ml-3 text-orange-400">
                · {snapshot.reportTags.join(" · ")}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Current / upcoming webinar */}
      <div className="mt-10">
        <SectionHeader
          label="current webinar"
          className="mb-3"
          action={
            snapshot.currentTag ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-orange-400">
                {snapshot.currentTag}
              </span>
            ) : null
          }
        />
        {snapshot.currentTag ? (
          <Panel className="grid gap-4 p-5 sm:grid-cols-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Date
              </p>
              <p className="mt-1 font-mono text-base text-zinc-100">
                {snapshot.currentDate ?? "—"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Leads so far
              </p>
              <p className="mt-1 font-mono text-base text-zinc-100">
                {snapshot.leadsForCurrent.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-zinc-600">
                tag · {snapshot.currentTag}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Cohort spend
              </p>
              <p className="mt-1 font-mono text-base text-zinc-100">
                {snapshot.cohortSpend != null ? inr(snapshot.cohortSpend) : "—"}
              </p>
              <p className="text-[10px] text-zinc-600">
                {snapshot.cohortDays > 0
                  ? `${snapshot.cohortDays} day${snapshot.cohortDays === 1 ? "" : "s"} since last webinar`
                  : "since last webinar"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                CPL
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base text-zinc-100">
                  {snapshot.cpl != null ? inr(snapshot.cpl) : "—"}
                </span>
                {onTrack != null ? (
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest ${
                      onTrack ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {onTrack ? "on track" : "above target"}
                  </span>
                ) : null}
              </p>
              {targetCpl != null ? (
                <p className="text-[10px] text-zinc-600">
                  target ~{inr(targetCpl)}
                </p>
              ) : null}
            </div>
          </Panel>
        ) : (
          <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
            Connect your Mainsheet to see your current webinar at a glance.
          </Panel>
        )}
      </div>

      {/* Daily ad spend bars */}
      <div className="mt-10">
        <SectionHeader
          label="daily ad spend · last 7 days"
          className="mb-3"
          action={
            <Link
              href="/client/daily-data"
              className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
            >
              full sheet →
            </Link>
          }
        />
        <Panel>
          {snapshot.dailySpend.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-500">
              No daily spend data found yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-900">
              {snapshot.dailySpend.map((d, i) => {
                const w = Math.max(2, Math.round((d.spend / maxSpend) * 100));
                return (
                  <li
                    key={i}
                    className="grid grid-cols-12 items-center gap-3 px-4 py-2.5"
                  >
                    <span className="col-span-3 font-mono text-xs text-zinc-400">
                      {d.date}
                    </span>
                    <div className="col-span-6 h-2 overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className="h-full rounded-full bg-orange-500/80"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className="col-span-3 text-right font-mono text-xs text-zinc-200">
                      {d.raw || "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Deliverables progress */}
      <div className="mt-10">
        <SectionHeader
          label="deliverables"
          className="mb-3"
          action={
            <Link
              href="/client/deliverables"
              className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
            >
              view →
            </Link>
          }
        />
        <Panel className="p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">What your team has built</span>
            <span className="font-mono text-zinc-200">
              {done ?? 0} / {total ?? 0}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div className="h-full bg-orange-500" style={{ width: `${pct}%` }} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        accent
          ? "border-orange-500/40 bg-orange-950/15"
          : "border-zinc-800 bg-zinc-950/60"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl ${accent ? "text-orange-300" : "text-zinc-100"}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}
