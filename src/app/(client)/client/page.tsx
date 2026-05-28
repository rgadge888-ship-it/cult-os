import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import type { WeeklyReport, WeeklyReportData } from "@/lib/db/types";

export default async function ClientDashboardPage() {
  const { profile } = await requireUser({ clientOnly: true });
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

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► snapshot
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Hello, {profile.full_name ?? profile.email.split("@")[0]}.
        </h1>
        <p className="text-sm text-zinc-500">your funnel, your reports, your progress</p>
      </div>

      {/* Latest report snapshot */}
      <div className="mt-8">
        <SectionHeader
          label="latest report"
          className="mb-3"
          action={
            <Link
              href="/client/reports"
              className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
            >
              all →
            </Link>
          }
        />
        {latestReport && m ? (
          <Link href={`/client/reports/${latestReport.id}`} className="block">
            <Panel className="p-5 hover:border-zinc-700">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400">
                  {latestReport.week_start_date} → {latestReport.week_end_date}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-orange-400">
                  view →
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Mini label="Spend" value={m.spend_with_gst?.raw} />
                <Mini label={latestReport.data.acq_label} value={m.cost_per_acq?.raw} />
                <Mini label="Registrations" value={m.registrations?.raw} />
                <Mini label="ROAS" value={m.roas?.raw} />
              </div>
            </Panel>
          </Link>
        ) : (
          <Panel className="px-6 py-10 text-center text-sm text-zinc-500">
            No report published yet. Your team will publish one after your next weekly call.
          </Panel>
        )}
      </div>

      {/* Deliverables progress */}
      <div className="mt-8">
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
            <div
              className="h-full bg-orange-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-base text-zinc-100">{value || "—"}</p>
    </div>
  );
}
