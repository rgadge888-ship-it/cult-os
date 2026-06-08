import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/ui/status-pill";
import { WeeklyReportView } from "@/components/reports/weekly-report-view";
import { ReportEditor } from "./report-editor";
import { can } from "@/lib/auth/permissions";
import type { WeeklyReport, WeeklyReportData, Client } from "@/lib/db/types";

export default async function ReportViewPage({
  params,
}: {
  params: Promise<{ clientId: string; reportId: string }>;
}) {
  const { clientId, reportId } = await params;
  const { profile } = await requireUser({ adminOnly: true });
  const supabase = await createClient();

  const [{ data: client }, { data: report }, { data: adminRows }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).single(),
    supabase.from("weekly_reports").select("*").eq("id", reportId).single(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["super_admin", "strategist", "automation", "copywriter", "admin"])
      .order("email"),
  ]);

  if (!client || !report) notFound();

  const r = report as WeeklyReport;
  const c = client as Pick<Client, "id" | "name">;
  const data = r.data as WeeklyReportData;
  const admins = (adminRows ?? []).map((a) => ({
    id: a.id,
    label: a.full_name ?? a.email.split("@")[0],
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        href={`/admin/clients/${clientId}/reports`}
        className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        ← Reports · {c.name}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
            ► report
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            {r.week_start_date} → {r.week_end_date}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={r.status} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            generated {new Date(r.generated_at).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-8">
        <WeeklyReportView clientName={c.name} data={data} />
      </div>

      <div className="mt-10">
        <ReportEditor
          reportId={r.id}
          clientId={clientId}
          status={r.status}
          narrative={r.narrative}
          discussion={r.discussion}
          mom={r.mom}
          admins={admins}
          canPublish={can(profile.role, "publish_report")}
          canCreateTasks={can(profile.role, "create_task")}
        />
      </div>
    </div>
  );
}
