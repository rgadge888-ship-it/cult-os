import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { MainsheetPreview, MainsheetTabMapping } from "./preview-tabs";
import { GenerateReportButton } from "./reports/generate-button";
import { InviteForm } from "./invite-form";
import { NewTaskForm } from "../../tasks/new-task-form";
import { TaskRow, type TaskRowData } from "../../tasks/task-row";
import { DeliverableRow } from "./deliverable-row";
import { DeliverableManage } from "./deliverable-manage";
import type { Client, Deliverable, WeeklyReport, Task } from "@/lib/db/types";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { user } = await requireUser({ adminOnly: true });
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();
  if (!client) notFound();

  const [
    { data: deliverables },
    { data: reports },
    { data: logins },
    { data: clientTasks },
    { data: allClients },
    { data: allAdmins },
  ] = await Promise.all([
    supabase.from("deliverables").select("*").eq("client_id", clientId).order("sort_order"),
    supabase
      .from("weekly_reports")
      .select("id, week_start_date, week_end_date, status, generated_at")
      .eq("client_id", clientId)
      .order("week_start_date", { ascending: false })
      .limit(10),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("client_id", clientId)
      .eq("role", "client"),
    supabase
      .from("tasks")
      .select("*")
      .eq("client_id", clientId)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["super_admin","strategist","automation","copywriter","admin"])
      .order("email"),
  ]);

  const c = client as Client;
  const d = (deliverables ?? []) as Deliverable[];
  const reportRows = (reports ?? []) as Pick<
    WeeklyReport,
    "id" | "week_start_date" | "week_end_date" | "status" | "generated_at"
  >[];

  const adminOptions = (allAdmins ?? []).map((a) => ({
    id: a.id,
    label: a.full_name ?? a.email.split("@")[0],
  }));
  const adminMap = new Map(adminOptions.map((a) => [a.id, a.label]));
  const taskRows: TaskRowData[] = ((clientTasks ?? []) as Task[]).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    assignee_id: t.assignee_id,
    client_id: t.client_id,
    client_name: c.name,
    assignee_name: t.assignee_id ? adminMap.get(t.assignee_id) ?? null : null,
  }));

  const grouped = d.reduce<Record<string, Deliverable[]>>((acc, row) => {
    const key = row.category ?? "Other";
    (acc[key] ??= []).push(row);
    return acc;
  }, {});

  const doneCount = d.filter((row) => row.status === "done").length;
  const totalCount = d.length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href="/admin/clients"
        className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        ← Clients
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
            ► client · {c.slug}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            {c.name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            {c.niche ? <span>{c.niche}</span> : null}
            <StatusPill status={c.status} />
            <span className="font-mono text-xs text-zinc-600">
              {c.plan === "three_month" ? "3-month plan" : "1-month plan"}
            </span>
          </div>
        </div>
      </div>

      {/* Overview cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          hint={`${pct}% complete`}
        />
        <Card
          label="Mainsheet"
          value={c.mainsheet_file_id ? "linked" : "not linked"}
          valueClass={c.mainsheet_file_id ? "text-emerald-400" : "text-zinc-500"}
        />
        <Card
          label="Start date"
          value={c.start_date ?? "—"}
        />
      </div>

      {/* Deliverables panel */}
      <div className="mt-10">
        <SectionHeader
          label="deliverables"
          className="mb-3"
          action={
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {doneCount} / {totalCount}
            </span>
          }
        />
        <Panel className="divide-y divide-zinc-900">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="px-5 py-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                {category}
              </p>
              <ul className="space-y-2">
                {items.map((item) => (
                  <DeliverableRow
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    status={item.status}
                    clientId={c.id}
                  />
                ))}
              </ul>
            </div>
          ))}
          {d.length === 0 ? (
            <div className="px-6 pt-8 pb-2 text-center text-sm text-zinc-500">
              No deliverables. Optional — add them below if this client is in launch
              phase (landing page, market research, etc.).
            </div>
          ) : null}
          <DeliverableManage clientId={c.id} isEmpty={d.length === 0} />
        </Panel>
      </div>

      {/* Mainsheet info panel */}
      <div className="mt-10">
        <SectionHeader label="data source" className="mb-3" />
        <Panel className="space-y-2 p-5 text-sm">
          <div className="flex gap-3">
            <span className="w-28 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Sheet URL
            </span>
            {c.mainsheet_url ? (
              <a
                href={c.mainsheet_url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-orange-400 underline-offset-2 hover:underline"
              >
                {c.mainsheet_url}
              </a>
            ) : (
              <span className="text-zinc-500">not set</span>
            )}
          </div>
          <div className="flex gap-3">
            <span className="w-28 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              File ID
            </span>
            <span className="font-mono text-xs text-zinc-400">
              {c.mainsheet_file_id ?? "—"}
            </span>
          </div>
          <div className="flex gap-3">
            <span className="w-28 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Connected
            </span>
            <span className="font-mono text-xs text-zinc-400">
              {c.sheets_connected_at
                ? new Date(c.sheets_connected_at).toLocaleString()
                : "—"}
            </span>
          </div>
        </Panel>
      </div>

      {/* Weekly reports */}
      <div className="mt-10">
        <SectionHeader
          label="weekly reports"
          className="mb-3"
          action={c.mainsheet_file_id ? <GenerateReportButton clientId={c.id} /> : null}
        />
        <Panel>
          {reportRows.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-500">
              {c.mainsheet_file_id
                ? "No reports yet. Generate one — Cult OS reads the Weekly Datasheet tab."
                : "Link a Mainsheet first to generate reports."}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-900">
              {reportRows.map((rep) => (
                <li key={rep.id} className="flex items-center justify-between px-5 py-3">
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

      {/* Tasks for this client */}
      <div className="mt-10">
        <SectionHeader
          label="tasks"
          className="mb-3"
          action={
            <NewTaskForm
              clients={allClients ?? []}
              admins={adminOptions}
              defaultClientId={c.id}
            />
          }
        />
        <Panel>
          {taskRows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              No tasks for this client yet. Add one above, or extract from a report's MOM.
            </div>
          ) : (
            <ul>
              {taskRows.map((t) => (
                <TaskRow key={t.id} task={t} admins={adminOptions} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Client login */}
      <div className="mt-10">
        <InviteForm clientId={c.id} existingLogins={logins ?? []} />
      </div>

      {/* Tab mapping — pin each Cult OS section to the right sheet tab */}
      <div className="mt-10">
        <MainsheetTabMapping
          userId={user.id}
          clientId={c.id}
          fileId={c.mainsheet_file_id}
          tabMap={c.tab_map ?? {}}
        />
      </div>

      {/* Live preview of the linked Mainsheet (requires Google connected) */}
      <div className="mt-10">
        <MainsheetPreview userId={user.id} fileId={c.mainsheet_file_id} />
      </div>
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
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 font-mono text-xl ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-600">{hint}</p> : null}
    </div>
  );
}
