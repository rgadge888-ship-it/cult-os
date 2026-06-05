import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesBatchAsAgency,
} from "@/lib/google/sheets";
import { resolveTabTitle, type TabMap } from "@/lib/sheets/tabs";
import { parseNumber, parseDateRange } from "@/lib/reports/parse";
import type { WeeklyReport, WeeklyReportData } from "@/lib/db/types";

const inr = (n: number) =>
  "₹" +
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(Math.abs(n)),
  );

function parseDdMmYyyy(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE — renders the shell + DB-only sections instantly; sheet-dependent
// sections stream in via <Suspense>.
// ─────────────────────────────────────────────────────────────────────────────

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

  const pct = total ? Math.round(((done ?? 0) / total) * 100) : 0;
  const latestReport = latest as
    | (Pick<WeeklyReport, "id" | "week_start_date" | "week_end_date"> & {
        data: WeeklyReportData;
      })
    | null;
  const m = latestReport?.data.current.metrics;
  const targetCpl = m?.cost_per_acq?.value ?? null;
  const fileId = client?.mainsheet_file_id ?? null;
  const tabMap = client?.tab_map ?? {};

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

      {/* This Month — cumulative from Monthly Datasheet tab, streams in */}
      <div className="mt-8">
        <SectionHeader label="this month" className="mb-3" />
        <Suspense fallback={<MonthlySkeleton />}>
          <MonthlyCumulativeSection fileId={fileId} tabMap={tabMap} />
        </Suspense>
      </div>

      {/* This Week — pure DB, renders immediately */}
      <div className="mt-10">
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
          <Suspense
            fallback={
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                week {latestReport.week_start_date} → {latestReport.week_end_date}
              </p>
            }
          >
            <WeekTagLine fileId={fileId} tabMap={tabMap} range={{
              start: latestReport.week_start_date,
              end: latestReport.week_end_date,
            }} />
          </Suspense>
        ) : null}
      </div>

      {/* Current Webinar — sheet read, streams in */}
      <div className="mt-10">
        <SectionHeader label="current webinar" className="mb-3" />
        <Suspense fallback={<CurrentWebinarSkeleton />}>
          <CurrentWebinarSection fileId={fileId} tabMap={tabMap} targetCpl={targetCpl} />
        </Suspense>
      </div>

      {/* Daily Spend — sheet read, streams in */}
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
        <Suspense fallback={<DailySpendSkeleton />}>
          <DailySpendSection fileId={fileId} tabMap={tabMap} />
        </Suspense>
      </div>

      {/* Deliverables — only shown when the team has actually set some up.
          Long-term clients past launch usually have none, so we hide it. */}
      {(total ?? 0) > 0 ? (
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
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING SECTIONS — each fetches its own slice of sheet data.
// They share the unstable_cache so repeat renders are deduped.
// ─────────────────────────────────────────────────────────────────────────────

async function WeekTagLine({
  fileId,
  tabMap,
  range,
}: {
  fileId: string | null;
  tabMap: TabMap;
  range: { start: string; end: string };
}) {
  if (!fileId) return null;
  let tags: string[] = [];
  try {
    const meta = await getSheetMetadataAsAgency(fileId);
    const schedTitle = resolveTabTitle("schedule", tabMap, meta.tabs.map((t) => t.title));
    const scheduleTab = schedTitle ? meta.tabs.find((t) => t.title === schedTitle) : null;
    if (!scheduleTab) return null;
    const batch = await getSheetValuesBatchAsAgency(
      fileId,
      [`'${scheduleTab.title}'!A:Z`],
      { formatted: true },
    );
    const sched = batch[`'${scheduleTab.title}'!A:Z`] ?? [];
    if (sched.length < 2) return null;
    const head = sched[0].map((h) => h.toLowerCase());
    const iTag = head.findIndex((h) => h.includes("workshop tag") || h.includes("tag"));
    const iDate = head.findIndex(
      (h) => h.includes("workshop date") || h.includes("date"),
    );
    if (iTag < 0 || iDate < 0) return null;
    const startMs = new Date(range.start + "T00:00:00Z").getTime();
    const endMs = new Date(range.end + "T23:59:59Z").getTime();
    for (const r of sched.slice(1)) {
      const tag = (r[iTag] ?? "").toString().trim();
      const d = parseDdMmYyyy((r[iDate] ?? "").toString().trim());
      if (tag && d && d.getTime() >= startMs && d.getTime() <= endMs) tags.push(tag);
    }
  } catch {
    return null;
  }

  return (
    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
      week {range.start} → {range.end}
      {tags.length > 0 ? (
        <span className="ml-3 text-orange-400">· {tags.join(" · ")}</span>
      ) : null}
    </p>
  );
}

async function CurrentWebinarSection({
  fileId,
  tabMap,
  targetCpl,
}: {
  fileId: string | null;
  tabMap: TabMap;
  targetCpl: number | null;
}) {
  if (!fileId) {
    return (
      <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
        Connect your Mainsheet to see your current webinar at a glance.
      </Panel>
    );
  }

  // One batchGet for schedule + leads + daily (cohort spend).
  let snapshot: {
    currentTag: string | null;
    currentDate: string | null;
    leadsForCurrent: number;
    totalLeads: number;
    cohortSpend: number | null;
    cohortDays: number;
    cpl: number | null;
  } | null = null;

  try {
    const meta = await getSheetMetadataAsAgency(fileId);
    const titles = meta.tabs.map((t) => t.title);
    const scheduleTab = resolveTabTitle("schedule", tabMap, titles);
    const leadsTab = resolveTabTitle("leads", tabMap, titles);
    const dailyTab = resolveTabTitle("daily", tabMap, titles);
    if (!scheduleTab || !leadsTab || !dailyTab) {
      throw new Error("missing tabs");
    }
    const ranges = [
      `'${scheduleTab}'!A:Z`,
      // No row cap — leads grow to 10k+ rows; the newest (this webinar's) sit
      // at the bottom and were being cut off by a fixed cap.
      `'${leadsTab}'!A:Z`,
      `'${dailyTab}'!A:Z`,
    ];
    const batch = await getSheetValuesBatchAsAgency(fileId, ranges, { formatted: true });
    const sched = batch[ranges[0]] ?? [];
    const leads = batch[ranges[1]] ?? [];
    const daily = batch[ranges[2]] ?? [];

    // Schedule → upcoming + previous events
    const events: { tag: string; date: Date; raw: string }[] = [];
    if (sched.length > 1) {
      const head = sched[0].map((h) => h.toLowerCase());
      const iTag = head.findIndex((h) => h.includes("workshop tag") || h.includes("tag"));
      const iDate = head.findIndex(
        (h) => h.includes("workshop date") || h.includes("date"),
      );
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
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const upcomingIdx = (() => {
      const i = events.findIndex((e) => e.date.getTime() >= startOfToday.getTime());
      return i >= 0 ? i : events.length - 1;
    })();
    const upcoming = upcomingIdx >= 0 ? events[upcomingIdx] : null;
    const prior = upcomingIdx > 0 ? events[upcomingIdx - 1] : null;

    // Cohort window
    const todayMs = (() => {
      const t = new Date();
      t.setUTCHours(23, 59, 59, 999);
      return t.getTime();
    })();
    const cohortStartMs = prior ? prior.date.getTime() + 24 * 3600 * 1000 : null;
    const cohortEndMs = Math.min(
      todayMs,
      upcoming ? upcoming.date.getTime() + 24 * 3600 * 1000 - 1 : todayMs,
    );
    const cohortDays = cohortStartMs
      ? Math.max(0, Math.round((cohortEndMs - cohortStartMs) / (24 * 3600 * 1000)) + 1)
      : 0;

    // Leads count for upcoming tag
    let leadsForCurrent = 0;
    let totalLeads = 0;
    if (leads.length > 1) {
      const head = leads[0].map((h) => h.toLowerCase());
      const iTag = head.findIndex((h) => h.includes("webinar tag") || h.includes("tag"));
      const dataRows = leads
        .slice(1)
        .filter((r) => r.some((c) => (c ?? "").trim() !== ""));
      totalLeads = dataRows.length;
      if (iTag >= 0 && upcoming) {
        leadsForCurrent = dataRows.filter(
          (r) => (r[iTag] ?? "").toString().trim() === upcoming.tag,
        ).length;
      }
    }

    // Cohort spend from daily rows
    let cohortSpend: number | null = null;
    if (cohortStartMs != null && daily.length > 1) {
      const head = daily[0].map((h) => h.toLowerCase());
      const iDate = head.findIndex((h) => h === "date" || h.startsWith("date"));
      const iSpend = head.findIndex(
        (h) => h === "with gst" || h === "ad spend" || h === "spend",
      );
      if (iDate >= 0 && iSpend >= 0) {
        const startIso = new Date(cohortStartMs).toISOString().slice(0, 10);
        const endIso = new Date(cohortEndMs).toISOString().slice(0, 10);
        let sum = 0;
        for (const r of daily.slice(1)) {
          const label = (r[iDate] ?? "").toString().trim();
          if (!label) continue;
          const dr = parseDateRange(label);
          if (!dr) continue;
          if (dr.start < startIso || dr.start > endIso) continue;
          sum += parseNumber(r[iSpend]) ?? 0;
        }
        cohortSpend = sum;
      }
    }

    const cpl =
      cohortSpend != null && leadsForCurrent > 0 ? cohortSpend / leadsForCurrent : null;

    snapshot = {
      currentTag: upcoming?.tag ?? null,
      currentDate: upcoming?.raw ?? null,
      leadsForCurrent,
      totalLeads,
      cohortSpend,
      cohortDays,
      cpl,
    };
  } catch {
    return (
      <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
        Couldn't read the Mainsheet right now.
      </Panel>
    );
  }

  if (!snapshot?.currentTag) {
    return (
      <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
        No upcoming webinar found in the schedule.
      </Panel>
    );
  }

  const onTrack =
    snapshot.cpl != null && targetCpl != null ? snapshot.cpl <= targetCpl * 1.2 : null;

  return (
    <Panel className="grid gap-4 p-5 sm:grid-cols-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Date
        </p>
        <p className="mt-1 font-mono text-base text-zinc-100">
          {snapshot.currentDate ?? "—"}
        </p>
        <p className="text-[10px] text-orange-400">{snapshot.currentTag}</p>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Leads so far
        </p>
        <p className="mt-1 font-mono text-base text-zinc-100">
          {snapshot.leadsForCurrent.toLocaleString("en-IN")}
        </p>
        <p className="text-[10px] text-zinc-600">
          of {snapshot.totalLeads.toLocaleString("en-IN")} total in sheet
        </p>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Ad spend
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
          <p className="text-[10px] text-zinc-600">target ~{inr(targetCpl)}</p>
        ) : null}
      </div>
    </Panel>
  );
}

async function DailySpendSection({
  fileId,
  tabMap,
}: {
  fileId: string | null;
  tabMap: TabMap;
}) {
  if (!fileId) {
    return (
      <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
        Connect your Mainsheet to see daily spend.
      </Panel>
    );
  }

  let dailySpend: { date: string; spend: number; raw: string }[] = [];
  try {
    const meta = await getSheetMetadataAsAgency(fileId);
    const dailyTitle = resolveTabTitle("daily", tabMap, meta.tabs.map((t) => t.title));
    const dailyTab = dailyTitle ? meta.tabs.find((t) => t.title === dailyTitle) : null;
    if (!dailyTab) {
      return (
        <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
          No Daily Datasheet tab found.
        </Panel>
      );
    }
    const range = `'${dailyTab.title}'!A:Z`;
    const batch = await getSheetValuesBatchAsAgency(fileId, [range], {
      formatted: true,
    });
    const daily = batch[range] ?? [];
    if (daily.length > 1) {
      const head = daily[0].map((h) => h.toLowerCase());
      const iDate = head.findIndex((h) => h === "date" || h.startsWith("date"));
      const iSpend = head.findIndex(
        (h) => h === "with gst" || h === "ad spend" || h === "spend",
      );
      if (iDate >= 0 && iSpend >= 0) {
        type Row = { label: string; iso: string; spend: number; raw: string };
        const parsed: Row[] = [];
        for (const r of daily.slice(1)) {
          const label = (r[iDate] ?? "").toString().trim();
          if (!label) continue;
          const dr = parseDateRange(label);
          if (!dr) continue;
          const raw = (r[iSpend] ?? "").toString().trim();
          parsed.push({
            label,
            iso: dr.start,
            spend: parseNumber(raw) ?? 0,
            raw,
          });
        }
        const todayIso = new Date().toISOString().slice(0, 10);
        parsed.sort((a, b) => a.iso.localeCompare(b.iso));
        dailySpend = parsed
          .filter((r) => r.iso <= todayIso)
          .slice(-7)
          .map((r) => ({ date: r.label, spend: r.spend, raw: r.raw }));
      }
    }
  } catch {
    return (
      <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
        Couldn't read daily spend right now.
      </Panel>
    );
  }

  if (dailySpend.length === 0) {
    return (
      <Panel className="px-6 py-8 text-center text-sm text-zinc-500">
        No daily spend data found yet.
      </Panel>
    );
  }

  const maxSpend = Math.max(1, ...dailySpend.map((d) => d.spend));

  return (
    <Panel>
      <ul className="divide-y divide-zinc-900">
        {dailySpend.map((d, i) => {
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
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────────────────────────────────────

function CurrentWebinarSkeleton() {
  return (
    <Panel className="grid gap-4 p-5 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-2 w-16" />
          <Skeleton className="mt-2 h-5 w-24" />
          <Skeleton className="mt-2 h-2 w-32" />
        </div>
      ))}
    </Panel>
  );
}

function MonthlySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
          <Skeleton className="h-2 w-16" />
          <Skeleton className="mt-3 h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

async function MonthlyCumulativeSection({
  fileId,
  tabMap,
}: {
  fileId: string | null;
  tabMap: TabMap;
}) {
  if (!fileId) return null;
  try {
    const meta = await getSheetMetadataAsAgency(fileId);
    const monthlyTitle = resolveTabTitle("monthly", tabMap, meta.tabs.map((t) => t.title));
    const monthlyTab = monthlyTitle ? meta.tabs.find((t) => t.title === monthlyTitle) : null;
    if (!monthlyTab) {
      return (
        <Panel className="px-6 py-6 text-center text-sm text-zinc-500">
          No Monthly Datasheet tab found in your Mainsheet.
        </Panel>
      );
    }

    const batch = await getSheetValuesBatchAsAgency(
      fileId,
      [`'${monthlyTab.title}'!A:Z`],
      { formatted: true },
    );
    const rows = batch[`'${monthlyTab.title}'!A:Z`] ?? [];
    if (rows.length < 2) {
      return (
        <Panel className="px-6 py-6 text-center text-sm text-zinc-500">
          No monthly rows yet.
        </Panel>
      );
    }

    const head = rows[0].map((h) => h.toLowerCase());
    const data = rows.slice(1).filter((r) => r.some((c) => (c ?? "").trim() !== ""));
    if (data.length === 0) {
      return (
        <Panel className="px-6 py-6 text-center text-sm text-zinc-500">
          No monthly rows yet.
        </Panel>
      );
    }
    const latest = data[data.length - 1];

    const idx = (...needles: string[]) =>
      head.findIndex((h) => needles.some((n) => h.includes(n)));
    const iRange = idx("date range", "date", "month");
    const iSpend = idx("with gst", "ad spend", "spend");
    const iRevenue = idx("total revenue", "revenue");
    const iConversions = idx("upsells", "converted");
    const iProfit = idx("gross profit", "net profit", "profit");

    const get = (i: number) => (i >= 0 ? (latest[i] ?? "").toString().trim() : "");

    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Ad Spend" value={get(iSpend)} />
          <Kpi label="Revenue" value={get(iRevenue)} accent />
          <Kpi label="Conversions (L1)" value={get(iConversions)} />
          <Kpi label="Net P/L" value={get(iProfit)} />
        </div>
        {iRange >= 0 && get(iRange) ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            {get(iRange)}
          </p>
        ) : null}
      </>
    );
  } catch (e) {
    return (
      <Panel className="px-6 py-6 text-center text-sm text-red-400">
        Couldn't read monthly data: {e instanceof Error ? e.message : "error"}
      </Panel>
    );
  }
}

function DailySpendSkeleton() {
  return (
    <Panel>
      <ul className="divide-y divide-zinc-900">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i} className="grid grid-cols-12 items-center gap-3 px-4 py-2.5">
            <Skeleton className="col-span-3 h-3" />
            <Skeleton className="col-span-6 h-2 rounded-full" />
            <Skeleton className="col-span-3 h-3" />
          </li>
        ))}
      </ul>
    </Panel>
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
