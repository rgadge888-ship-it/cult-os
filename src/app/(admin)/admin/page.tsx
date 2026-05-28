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
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(Math.abs(n)),
  );
}

function metricValue(m: MetricSet | undefined, field: keyof MetricSet): number | null {
  return m?.[field]?.value ?? null;
}

const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

export default async function AdminDashboardPage() {
  const { profile } = await requireUser({ adminOnly: true });
  const supabase = await createClient();

  const [
    { data: clients },
    { data: allReports },
    { data: recentActivity },
    { count: openTasks },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, status, plan, niche"),
    supabase
      .from("weekly_reports")
      .select("client_id, week_start_date, week_end_date, data, mom, status, published_at, generated_at")
      .order("week_start_date", { ascending: false }),
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
  ]);

  const allClients = (clients ?? []) as Pick<Client, "id" | "name" | "status" | "plan" | "niche">[];
  const reports = (allReports ?? []) as Pick<
    WeeklyReport,
    "client_id" | "week_start_date" | "week_end_date" | "data" | "mom" | "status" | "published_at" | "generated_at"
  >[];

  // Latest published report per client.
  const latestPerClient = new Map<string, typeof reports[number]>();
  for (const r of reports) {
    if (r.status !== "published") continue;
    if (!latestPerClient.has(r.client_id)) latestPerClient.set(r.client_id, r);
  }

  // Cumulative stats from latest published reports across all clients.
  let cumSpend = 0;
  let cumRevenue = 0;
  const alerts: { id: string; name: string; reason: string; tone: "red" | "amber" }[] = [];

  const activeClients = allClients.filter((c) => c.status === "active");
  const now = Date.now();

  for (const c of activeClients) {
    const r = latestPerClient.get(c.id);
    if (!r) {
      alerts.push({
        id: c.id,
        name: c.name,
        reason: "No published report yet",
        tone: "amber",
      });
      continue;
    }
    const m = (r.data as WeeklyReportData)?.current?.metrics;
    const spend = metricValue(m, "spend_with_gst") ?? metricValue(m, "spend") ?? 0;
    const revenue = metricValue(m, "revenue") ?? 0;
    const roas = metricValue(m, "roas");
    const net = metricValue(m, "net_profit");
    cumSpend += spend;
    cumRevenue += revenue;

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
    if (net != null && net < 0) {
      alerts.push({ id: c.id, name: c.name, reason: `Net ${inr(net)} (loss)`, tone: "red" });
    }
  }

  const blendedRoas = cumSpend > 0 ? cumRevenue / cumSpend : 0;

  const recentMoms = reports
    .filter((r) => r.mom && r.mom.trim().length > 0)
    .slice(0, 5);
  const clientNameMap = new Map(allClients.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► command center
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Welcome back, {profile.full_name ?? profile.email.split("@")[0]}.
        </h1>
        <p className="text-sm text-zinc-500">
          across all clients · most-recent-week cumulative
        </p>
      </div>

      {/* TOP STATS */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active clients" value={String(activeClients.length)} hint={`of ${allClients.length} total`} />
        <Stat label="Revenue (latest week)" value={inr(cumRevenue)} hint="sum of latest published reports" />
        <Stat label="Ad spend (latest week)" value={inr(cumSpend)} hint="with GST" />
        <Stat
          label="Blended ROAS"
          value={cumSpend > 0 ? `${blendedRoas.toFixed(2)}x` : "—"}
          hint="revenue ÷ spend"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat label="Open tasks" value={String(openTasks ?? 0)} hint="all team, not done" />
        <Stat
          label="Reports published"
          value={String(latestPerClient.size)}
          hint={`${activeClients.length - latestPerClient.size} active client(s) without a published report`}
        />
      </div>

      {/* RED ALERTS */}
      <div className="mt-10">
        <SectionHeader
          label="red alerts"
          className="mb-3"
          action={
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {alerts.length} flagged
            </span>
          }
        />
        <Panel>
          {alerts.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-emerald-400">
              Everything green. No clients flagged.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-900">
              {alerts.map((a, i) => (
                <li key={`${a.id}-${i}`} className="flex items-center justify-between px-5 py-3">
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
                  <li key={`${r.client_id}-${r.week_start_date}`} className="px-5 py-3">
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
                  <li key={a.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        {a.action}
                      </span>{" "}
                      <span className="text-xs text-zinc-300">
                        {a.client_id ? clientNameMap.get(a.client_id) ?? "" : ""}
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl text-zinc-100">{value}</p>
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
