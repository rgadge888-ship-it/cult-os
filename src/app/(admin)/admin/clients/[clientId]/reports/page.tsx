import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { GenerateReportButton } from "./generate-button";
import { listWeeklyReportRanges, type WeeklyReportRangeOption } from "@/lib/reports/build-weekly";
import type { Client, WeeklyReport } from "@/lib/db/types";

export default async function ClientReportsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { user } = await requireUser({ adminOnly: true });
  const supabase = await createClient();

  const [{ data: client }, { data: reports }] = await Promise.all([
    supabase.from("clients").select("id, mainsheet_file_id, tab_map").eq("id", clientId).single(),
    supabase
      .from("weekly_reports")
      .select("id, week_start_date, week_end_date, status, generated_at")
      .eq("client_id", clientId)
      .order("week_start_date", { ascending: false })
      .limit(25),
  ]);

  if (!client) notFound();

  const c = client as Pick<Client, "id" | "mainsheet_file_id" | "tab_map">;
  const reportRows = (reports ?? []) as Pick<
    WeeklyReport,
    "id" | "week_start_date" | "week_end_date" | "status" | "generated_at"
  >[];
  let weeklyOptions: WeeklyReportRangeOption[] = [];
  let weeklyOptionsError: string | null = null;
  if (c.mainsheet_file_id) {
    try {
      weeklyOptions = await listWeeklyReportRanges(
        user.id,
        c.mainsheet_file_id,
        c.tab_map,
      );
    } catch (e) {
      weeklyOptionsError = e instanceof Error ? e.message : "Could not read weekly ranges.";
    }
  }
  const reportStatusByStart = Object.fromEntries(
    reportRows.map((report) => [report.week_start_date, report.status]),
  );

  return (
    <div>
      <SectionHeader
        label="weekly reports"
        className="mb-3"
        action={
          c.mainsheet_file_id ? (
            <GenerateReportButton
              clientId={c.id}
              options={weeklyOptions}
              optionsError={weeklyOptionsError}
              reportStatusByStart={reportStatusByStart}
            />
          ) : null
        }
      />
      <Panel>
        {reportRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            {c.mainsheet_file_id
              ? "No reports yet. Generate one — Cult OS reads the Weekly Datasheet tab."
              : "Link a Mainsheet first to generate reports."}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {reportRows.map((rep) => (
              <li key={rep.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <Link
                  href={`/admin/clients/${c.id}/reports/${rep.id}`}
                  className="font-mono text-sm text-zinc-200 hover:text-orange-400"
                >
                  {rep.week_start_date} → {rep.week_end_date}
                </Link>
                <div className="flex items-center gap-3">
                  <StatusPill status={rep.status} />
                  <span className="font-mono text-[10px] text-zinc-600">
                    {new Date(rep.generated_at).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
