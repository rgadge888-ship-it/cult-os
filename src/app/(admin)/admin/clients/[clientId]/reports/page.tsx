import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { GenerateReportButton } from "./generate-button";
import type { Client, WeeklyReport } from "@/lib/db/types";

export default async function ClientReportsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: reports }] = await Promise.all([
    supabase.from("clients").select("id, mainsheet_file_id").eq("id", clientId).single(),
    supabase
      .from("weekly_reports")
      .select("id, week_start_date, week_end_date, status, generated_at")
      .eq("client_id", clientId)
      .order("week_start_date", { ascending: false })
      .limit(25),
  ]);

  if (!client) notFound();

  const c = client as Pick<Client, "id" | "mainsheet_file_id">;
  const reportRows = (reports ?? []) as Pick<
    WeeklyReport,
    "id" | "week_start_date" | "week_end_date" | "status" | "generated_at"
  >[];

  return (
    <div>
      <SectionHeader
        label="weekly reports"
        className="mb-3"
        action={c.mainsheet_file_id ? <GenerateReportButton clientId={c.id} /> : null}
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
