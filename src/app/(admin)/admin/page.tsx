import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  ActivityLog,
  Client,
  MetricSet,
  WeeklyReport,
  WeeklyReportData,
} from "@/lib/db/types";

function inr(n: number): string {
  return (
    "₹" +
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      Math.round(Math.abs(n)),
    )
  );
}

function metricValue(m: MetricSet | undefined, field: keyof MetricSet): number | null {
  return m?.[field]?.value ?? null;
}

const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// Friendlier labels for the activity feed.
const ACTION_LABEL: Record<string, string> = {
  "client.created": "created client",
  "client.login_created": "created client login",
  "report.generated": "generated report",
  "report.published": "published report",
  "report.unpublished": "unpublished report",
  "deliverable.completed": "completed deliverable",
};

export default async function AdminDashboardPage() {
  const { profile } = await requireUser({ adminOnly: true });
  const supabase = await createClient();

  const [
    { data: clients },
    { data: allReports },
    { data: recentActivity },
    { count: openTasks },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, slug, status, plan, niche"),
    supabase
      .from("weekly_reports")
      .select(
        "client_id, week_start_date, week_end_date, data, mom, status, published_at, generated_at",
      )
      .order("week_start_date", { ascending: false }),
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
  ]);

  const allClients = (clients ?? []) as Pick<
    Client,
    "id" | "name" | "slug" | "status" | "plan" | "niche"
  >[];
  const reports = (allReports ?? []) as Pick<
    WeeklyReport,
    | "client_id"
    | "week_start_date"
    | "week_end_date"
    | "data"
    | "mom"
    | "status"
    | "published_at"
    | "generated_at"
  >[];

  // Latest + previous published report per client (for WoW deltas + table).
  const latestPerClient = new Map<string, (typeof reports)[number]>();
  const previousPerClient = new Map<string, (typeof reports)[number]>();
  for (const r of reports) {
    if (r.status !== "published") continue;
    if (!latestPerClient.has(r.client_id)) {
      latestPerClient.set(r.client_id, r);
    } else if (!previousPerClient.has(r.client_id)) {
      previousPerClient.set(r.client_id, r);
    }
  }

  const activeClients = allClients.filter((c) => c.status !== "churned");
  const now = new Date().getTime();

  let cumSpendCurr = 0;
  let cumRevenueCurr = 0;
  let cumSpendPrev = 0;
  let cumRevenuePrev = 0;
  const alerts: {
    id: string;
    name: string;
    reason: string;
    tone: "red" | "amber";
  }[] = [];

  // Per-client snapshot rows.
  type ClientRow = {
    id: string;
    name: string;
    status: Client["status"];
    plan: Client["plan"];
    spend: number | null;
    revenue: number | null;
    roas: number | null;
    cpr: number | null;
    netProfit: number | null;
    weekEnd: string | null;
  };
  const clientRows: ClientRow[] = [];

  for (const c of activeClients) {
    const r = latestPerClient.get(c.id);
    const p = previousPerClient.get(c.id);
    const mCurr = (r?.data as WeeklyReportData)?.current?.metrics;
    const mPrev = (p?.data as WeeklyReportData)?.current?.metrics;

    const spend =
      metricValue(mCurr, "spend_with_gst") ?? metricValue(mCurr, "spend") ?? null;
    const revenue = metricValue(mCurr, "revenue");
    const roas = metricValue(mCurr, "roas");
    const cpr = metricValue(mCurr, "cost_per_acq");
    const netProfit = metricValue(mCurr, "net_profit");

    if (spend != null) cumSpendCurr += spend;
    if (revenue != null) cumRevenueCurr += revenue;

    const prevSpend =
      metricValue(mPrev, "spend_with_gst") ?? metricValue(mPrev, "spend") ?? null;
    const prevRevenue = metricValue(mPrev, "revenue");
    if (prevSpend != null) cumSpendPrev += prevSpend;
    if (prevRevenue != null) cumRevenuePrev += prevRevenue;

    clientRows.push({
      id: c.id,
      name: c.name,
      status: c.status,
      plan: c.plan,
      spend,
      revenue,
      roas,
      cpr,
      netProfit,
      weekEnd: r?.week_end_date ?? null,
    });

    if (!r) {
      alerts.push({ id: c.id, name: c.name, reason: "No published report yet", tone: "amber" });
      continue;
    }
    const reportEnd = new Date(r.week_end_date).getTime();
    if (now - reportEnd > DAYS(14)) {
      alerts.push({
        id: c.id,
        name: c.name,
        reason: `Stale — last report ${r.week_end_date}`,
        tone: "amber",
      });
    }
    if (roas != null && roas < 2) {
      alerts.push({ id: c.id, name: c.name, reason: `ROAS ${roas.toFixed(2)}x`, tone: "red" });
    }
    if (netProfit != null && netProfit < 0) {
      alerts.push({
        id: c.id,
        name: c.name,
        reason: `Net ${inr(netProfit)} (loss)`,
        tone: "red",
      });
    }
  }

  // Sort client rows: red first (negative net), then by revenue desc.
  clientRows.sort((a, b) => {
    const aRisk = (a.netProfit ?? 0) < 0 ? 1 : 0;
    const bRisk = (b.netProfit ?? 0) < 0 ? 1 : 0;
    if (aRisk !== bRisk) return bRisk - aRisk;
    return (b.revenue ?? 0) - (a.revenue ?? 0);
  });

  const blendedRoas = cumSpendCurr > 0 ? cumRevenueCurr / cumSpendCurr : 0;
  const blendedRoasPrev = cumSpendPrev > 0 ? cumRevenuePrev / cumSpendPrev : 0;

  const recentMoms = reports
    .filter((r) => r.mom && r.mom.trim().length > 0)
    .slice(0, 5);
  const clientNameMap = new Map(allClients.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
            ► command center
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Welcome back, {profile.full_name ?? profile.email.split("@")[0]}.
          </h1>
          <p className="text-sm text-zinc-500">
            across all clients · most-recent published week
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/clients/new"
            className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400"
          >
            + New client
          </Link>
          <Link
            href="/admin/tasks"
            className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
          >
            Tasks · {openTasks ?? 0}
          </Link>
        </div>
      </div>

      {/* TOP KPIs with WoW deltas */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Active clients"
          value={String(activeClients.length)}
          hint={`of ${allClients.length} total`}
        />
        <Kpi
          label="Revenue (latest week)"
          value={inr(cumRevenueCurr)}
          delta={deltaPct(cumRevenueCurr, cumRevenuePrev)}
          deltaGoodWhenUp
          hint="sum of latest published reports"
        />
        <Kpi
          label="Ad spend (latest week)"
          value={inr(cumSpendCurr)}
          delta={deltaPct(cumSpendCurr, cumSpendPrev)}
          hint="with GST"
        />
        <Kpi
          label="Blended ROAS"
          value={cumSpendCurr > 0 ? `${blendedRoas.toFixed(2)}x` : "—"}
          delta={cumSpendPrev > 0 ? deltaPct(blendedRoas, blendedRoasPrev) : null}
          deltaGoodWhenUp
          hint="revenue ÷ spend"
        />
      </div>

      {/* RED ALERTS */}
      <div className="mt-10">
        <SectionHeader
          label="red alerts"
          className="mb-3"
          action={
            <span
              className={`font-mono text-[10px] uppercase tracking-widest ${
                alerts.length === 0 ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              {alerts.length === 0 ? "all clear" : `${alerts.length} flagged`}
            </span>
          }
        />
        <Panel>
          {alerts.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-emerald-400">
              Everything green. No clients flagged.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-900">
              {alerts.map((a, i) => (
                <li
                  key={`${a.id}-${i}`}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <Link
                    href={`/admin/clients/${a.id}`}
                    className="text-sm text-zinc-100 hover:text-orange-400"
                  >
                    {a.name}
                  </Link>
                  <span
                    className={`font-mono text-xs ${
                      a.tone === "red" ? "text-red-400" : "text-amber-400"
                    }`}
                  >
                    {a.tone === "red" ? "⚠" : "·"} {a.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* PER-CLIENT SNAPSHOT — every active client at a glance */}
      <div className="mt-10">
        <SectionHeader
          label="clients · latest week"
          className="mb-3"
          action={
            <Link
              href="/admin/clients"
              className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
            >
              all clients →
            </Link>
          }
        />
        <Panel className="overflow-hidden">
          {clientRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">
              No clients yet. Create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                    <th className="px-4 py-2.5 text-left font-normal">Client</th>
                    <th className="px-4 py-2.5 text-left font-normal">Status</th>
                    <th className="px-4 py-2.5 text-right font-normal">Spend</th>
                    <th className="px-4 py-2.5 text-right font-normal">Revenue</th>
                    <th className="px-4 py-2.5 text-right font-normal">ROAS</th>
                    <th className="px-4 py-2.5 text-right font-normal">CPR</th>
                    <th className="px-4 py-2.5 text-right font-normal">Net P/L</th>
                    <th className="px-4 py-2.5 text-right font-normal">Week</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRows.map((r) => {
                    const negative = (r.netProfit ?? 0) < 0;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-zinc-900/60 last:border-b-0 hover:bg-zinc-950/60"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/clients/${r.id}`}
                            className="text-zinc-100 hover:text-orange-400"
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                          {r.spend != null ? inr(r.spend) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-100">
                          {r.revenue != null ? inr(r.revenue) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-100">
                          {r.roas != null ? `${r.roas.toFixed(2)}x` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                          {r.cpr != null ? inr(r.cpr) : "—"}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono ${
                            negative ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {r.netProfit != null
                            ? (negative ? "−" : "+") + inr(r.netProfit)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[10px] text-zinc-500">
                          {r.weekEnd ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* RECENT MOMs + ACTIVITY */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader label="recent moms" className="mb-3" />
          <Panel>
            {recentMoms.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-500">
                No call notes yet.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-900">
                {recentMoms.map((r) => (
                  <li
                    key={`${r.client_id}-${r.week_start_date}`}
                    className="px-5 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-zinc-100">
                        {clientNameMap.get(r.client_id) ?? "—"}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {r.week_start_date} → {r.week_end_date}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{r.mom}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div>
          <SectionHeader label="activity" className="mb-3" />
          <Panel>
            {(recentActivity ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-500">
                Nothing yet.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-900">
                {(recentActivity as ActivityLog[]).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-baseline justify-between gap-3 px-5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-zinc-300">
                        {ACTION_LABEL[a.action] ?? a.action}
                      </span>{" "}
                      <span className="text-xs text-zinc-500">
                        {a.client_id ? `· ${clientNameMap.get(a.client_id) ?? ""}` : ""}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-600">
                      {timeAgo(new Date(a.created_at).getTime())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta,
  deltaGoodWhenUp,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  deltaGoodWhenUp?: boolean;
}) {
  const showDelta = delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.5;
  const up = (delta ?? 0) > 0;
  const goodish =
    deltaGoodWhenUp === undefined ? null : deltaGoodWhenUp === up;
  const deltaColor =
    goodish == null ? "text-zinc-500" : goodish ? "text-emerald-400" : "text-red-400";
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-mono text-2xl text-zinc-100">{value}</p>
        {showDelta ? (
          <span className={`font-mono text-[10px] ${deltaColor}`}>
            {up ? "▲" : "▼"} {Math.abs(delta!).toFixed(0)}%
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
