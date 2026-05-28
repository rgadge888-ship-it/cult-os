import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { NewTaskForm } from "./new-task-form";
import { TaskRow, type TaskRowData } from "./task-row";
import type { Task, TaskStatus } from "@/lib/db/types";

const VALID_VIEWS = new Set(["all", "mine", "unassigned", "open"]);

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; client?: string }>;
}) {
  const { user } = await requireUser({ adminOnly: true });
  const sp = await searchParams;
  const view = VALID_VIEWS.has(sp.view ?? "") ? (sp.view as string) : "open";
  const clientFilter = sp.client ?? null;

  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("*")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });

  if (view === "mine") query = query.eq("assignee_id", user.id);
  if (view === "unassigned") query = query.is("assignee_id", null);
  if (view === "open") query = query.neq("status", "done");
  if (clientFilter) query = query.eq("client_id", clientFilter);

  const [{ data: tasks }, { data: clients }, { data: admins }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["admin", "super_admin"])
      .order("email"),
  ]);

  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const adminMap = new Map(
    (admins ?? []).map((a) => [a.id, a.full_name ?? a.email.split("@")[0]]),
  );
  const adminOptions = (admins ?? []).map((a) => ({
    id: a.id,
    label: a.full_name ?? a.email.split("@")[0],
  }));

  const rows: TaskRowData[] = ((tasks ?? []) as Task[]).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    assignee_id: t.assignee_id,
    client_id: t.client_id,
    client_name: t.client_id ? clientMap.get(t.client_id) ?? null : null,
    assignee_name: t.assignee_id ? adminMap.get(t.assignee_id) ?? null : null,
  }));

  const counts = await getCounts(supabase, user.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
            ► tasks
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Team tasks
          </h1>
          <p className="text-sm text-zinc-500">
            what's getting done, by whom, by when
          </p>
        </div>
        <NewTaskForm clients={clients ?? []} admins={adminOptions} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ViewLink current={view} value="open" label="Open" count={counts.open} />
        <ViewLink current={view} value="mine" label="My tasks" count={counts.mine} />
        <ViewLink current={view} value="unassigned" label="Unassigned" count={counts.unassigned} />
        <ViewLink current={view} value="all" label="All" count={counts.all} />
      </div>

      <div className="mt-6">
        <SectionHeader label={`${view} · ${rows.length}`} className="mb-3" />
        <Panel>
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              No tasks here. Create one with "+ New task".
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-12 gap-3 border-b border-zinc-900 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:grid">
                <span className="col-span-2">Status</span>
                <span className="col-span-5">Task</span>
                <span className="col-span-2">Client</span>
                <span className="col-span-2">Assignee</span>
                <span className="col-span-1 text-right">Due · prio</span>
              </div>
              <ul>
                {rows.map((t) => (
                  <TaskRow key={t.id} task={t} admins={adminOptions} />
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

async function getCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const [open, mine, unassigned, all] = await Promise.all([
    supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assignee_id", userId)
      .neq("status", "done"),
    supabase.from("tasks").select("*", { count: "exact", head: true }).is("assignee_id", null),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
  ]);

  return {
    open: open.count ?? 0,
    mine: mine.count ?? 0,
    unassigned: unassigned.count ?? 0,
    all: all.count ?? 0,
  };
}

function ViewLink({
  current,
  value,
  label,
  count,
}: {
  current: string;
  value: string;
  label: string;
  count: number;
}) {
  const active = current === value;
  return (
    <Link
      href={`/admin/tasks?view=${value}`}
      className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs uppercase tracking-widest ${
        active
          ? "border-orange-500 bg-orange-950/30 text-orange-300"
          : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
      }`}
    >
      {label}
      <span className="font-mono text-[10px] text-zinc-500">{count}</span>
    </Link>
  );
}
