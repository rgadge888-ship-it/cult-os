import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import type { Client, Deliverable, WeeklyReport } from "@/lib/db/types";

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [
    { data: client },
    { data: deliverables },
    { data: latestReport },
    { count: openTasks },
    { count: loginCount },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase.from("deliverables").select("*").eq("client_id", clientId),
    supabase
      .from("weekly_reports")
      .select("id, week_start_date, week_end_date, status, generated_at")
      .eq("client_id", clientId)
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("status", "done"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("role", "client"),
  ]);

  if (!client) notFound();

  const c = client as Client;
  const d = (deliverables ?? []) as Deliverable[];
  const report = latestReport as
    | Pick<WeeklyReport, "id" | "week_start_date" | "week_end_date" | "status" | "generated_at">
    | null;
  const doneCount = d.filter((row) => row.status === "done").length;
  const totalCount = d.length;
  const deliverablePct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader label="overview" className="mb-3" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Monthly budget"
            value={
              c.monthly_ad_budget_inr
                ? `₹${Number(c.monthly_ad_budget_inr).toLocaleString("en-IN")}`
                : "—"
            }
          />
          <Card
            label="Deliverables"
            value={`${doneCount}/${totalCount}`}
            hint={`${deliverablePct}% complete`}
          />
          <Card label="Open tasks" value={String(openTasks ?? 0)} />
          <Card
            label="Mainsheet"
            value={c.mainsheet_file_id ? "linked" : "not linked"}
            valueClass={c.mainsheet_file_id ? "text-emerald-400" : "text-zinc-500"}
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader label="latest report" className="mb-3" />
          <Panel className="p-5">
            {report ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/admin/clients/${clientId}/reports/${report.id}`}
                    className="font-mono text-sm text-zinc-100 hover:text-orange-400"
                  >
                    {report.week_start_date} → {report.week_end_date}
                  </Link>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    generated {new Date(report.generated_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={report.status} />
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No weekly report generated yet.
              </p>
            )}
          </Panel>
        </div>

        <div>
          <SectionHeader label="account health" className="mb-3" />
          <Panel className="space-y-3 p-5 text-sm">
            <Row label="Client login" value={(loginCount ?? 0) > 0 ? "created" : "not created"} />
            <Row label="Start date" value={c.start_date ?? "—"} />
            <Row
              label="Sheets connected"
              value={c.sheets_connected_at ? new Date(c.sheets_connected_at).toLocaleString() : "—"}
            />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  valueClass = "text-zinc-100",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <Panel className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 font-mono text-xl ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-600">{hint}</p> : null}
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}
