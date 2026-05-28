import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  WeeklyReportView,
  ReportNarrative,
} from "@/components/reports/weekly-report-view";
import type { WeeklyReport, WeeklyReportData } from "@/lib/db/types";

export default async function ClientReportViewPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const { profile } = await requireUser({ clientOnly: true });
  const supabase = await createClient();

  // RLS ensures a client can only fetch their own published report.
  const { data: report } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (!report || report.status !== "published") notFound();

  const r = report as WeeklyReport;
  const data = r.data as WeeklyReportData;

  // Resolve the client's display name for the report header.
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", profile.client_id!)
    .single();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        href="/client/reports"
        className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        ← Reports
      </Link>
      <div className="mt-3 mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">► report</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          {r.week_start_date} → {r.week_end_date}
        </h1>
      </div>

      <div className="space-y-8">
        <WeeklyReportView clientName={client?.name ?? "Your account"} data={data} />
        <ReportNarrative
          narrative={r.narrative}
          discussion={r.discussion}
          mom={r.mom}
        />
      </div>
    </div>
  );
}
