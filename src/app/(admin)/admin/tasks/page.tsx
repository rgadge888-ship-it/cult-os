import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { NewTaskForm } from "./new-task-form";
import { TaskColumnFilters, type TaskColumnFilterValues } from "./task-column-filters";
import { TaskRow, type TaskRowData } from "./task-row";
import { TASK_TYPE_LABEL } from "@/lib/tasks";
import type { Task, TaskPriority, TaskStatus } from "@/lib/db/types";

const VALID_VIEWS = new Set(["all", "mine", "unassigned", "open"]);
const VALID_TYPES = new Set(["all", "weekly", "mom"]);
const VALID_STATUSES = new Set(["all", "todo", "in_progress", "blocked", "done"]);
const VALID_PRIORITIES = new Set(["all", "low", "medium", "high", "urgent"]);

type TaskTypeFilter = "all" | "weekly" | "mom";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    type?: string;
    status?: string;
    client?: string;
    assignee?: string;
    priority?: string;
  }>;
}) {
  const { user, profile } = await requireUser({ adminOnly: true });
  const sp = await searchParams;
  const view = VALID_VIEWS.has(sp.view ?? "") ? (sp.view as string) : "open";
  const type = VALID_TYPES.has(sp.type ?? "") ? (sp.type as TaskTypeFilter) : "all";
  const statusFilter = VALID_STATUSES.has(sp.status ?? "")
    ? (sp.status as TaskStatus | "all")
    : "all";
  const clientFilter = sp.client ?? "";
  const assigneeFilter = sp.assignee ?? "";
  const priorityFilter = VALID_PRIORITIES.has(sp.priority ?? "")
    ? (sp.priority as TaskPriority | "all")
    : "all";

  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("*")
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });

  if (view === "mine") query = query.eq("assignee_id", user.id);
  if (view === "unassigned") query = query.is("assignee_id", null);
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  } else if (view === "open") {
    query = query.neq("status", "done");
  }
  if (type === "weekly") query = query.eq("task_type", "weekly");
  if (type === "mom") query = query.eq("task_type", "client_mom");
  if (clientFilter === "none") query = query.is("client_id", null);
  if (clientFilter && clientFilter !== "none") query = query.eq("client_id", clientFilter);
  if (assigneeFilter === "unassigned") query = query.is("assignee_id", null);
  if (assigneeFilter && assigneeFilter !== "unassigned") {
    query = query.eq("assignee_id", assigneeFilter);
  }
  if (priorityFilter !== "all") query = query.eq("priority", priorityFilter);

  const [{ data: tasks }, { data: clients }, { data: admins }] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["super_admin","strategist","automation","copywriter","admin"])
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
  const clientOptions = (clients ?? []).map((c) => ({ id: c.id, name: c.name }));
  const columnFilters: TaskColumnFilterValues = {
    view,
    type,
    status: statusFilter,
    client: clientFilter,
    assignee: assigneeFilter,
    priority: priorityFilter,
  };

  const rows: TaskRowData[] = ((tasks ?? []) as Task[]).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    task_type: t.task_type,
    due_date: t.due_date,
    created_at: t.created_at,
    assignee_id: t.assignee_id,
    client_id: t.client_id,
    client_name: t.client_id ? clientMap.get(t.client_id) ?? null : null,
    assignee_name: t.assignee_id ? adminMap.get(t.assignee_id) ?? null : null,
  }));

  const counts = await getCounts(supabase, user.id, type);

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
            what is getting done, by whom, by when
          </p>
        </div>
        <NewTaskForm clients={clientOptions} admins={adminOptions} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ViewLink filters={columnFilters} value="open" label="Open" count={counts.open} />
        <ViewLink filters={columnFilters} value="mine" label="My tasks" count={counts.mine} />
        <ViewLink
          filters={columnFilters}
          value="unassigned"
          label="Unassigned"
          count={counts.unassigned}
        />
        <ViewLink filters={columnFilters} value="all" label="All" count={counts.all} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TypeLink filters={columnFilters} value="all" label="All types" />
        <TypeLink filters={columnFilters} value="weekly" label="Weekly" />
        <TypeLink filters={columnFilters} value="mom" label="Client / MOM" />
      </div>

      <div className="mt-6">
        <SectionHeader label={`${view} · ${typeLabel(type)} · ${rows.length}`} className="mb-3" />
        <Panel>
          <div className="hidden grid-cols-12 gap-3 border-b border-zinc-900 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:grid">
            <span className="col-span-2">Status</span>
            <span className="col-span-3">Task</span>
            <span className="col-span-1">Type</span>
            <span className="col-span-2">Client</span>
            <span className="col-span-2">Assignee</span>
            <span className="col-span-2 text-right">Added · due</span>
          </div>
          <TaskColumnFilters
            values={columnFilters}
            clients={clientOptions}
            admins={adminOptions}
          />
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              No tasks match these filters.
            </div>
          ) : (
              <ul>
                {rows.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    admins={adminOptions}
                    clients={clientOptions}
                    canDelete={profile.role === "super_admin"}
                  />
                ))}
              </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

async function getCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: TaskTypeFilter,
) {
  const scoped = () => {
    let query = supabase.from("tasks").select("*", { count: "exact", head: true });
    if (type === "weekly") query = query.eq("task_type", "weekly");
    if (type === "mom") query = query.eq("task_type", "client_mom");
    return query;
  };

  const [open, mine, unassigned, all] = await Promise.all([
    scoped().neq("status", "done"),
    scoped().eq("assignee_id", userId).neq("status", "done"),
    scoped().is("assignee_id", null),
    scoped(),
  ]);

  return {
    open: open.count ?? 0,
    mine: mine.count ?? 0,
    unassigned: unassigned.count ?? 0,
    all: all.count ?? 0,
  };
}

function ViewLink({
  filters,
  value,
  label,
  count,
}: {
  filters: TaskColumnFilterValues;
  value: string;
  label: string;
  count: number;
}) {
  const active = filters.view === value;
  return (
    <Link
      href={taskHref({ ...filters, view: value })}
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

function TypeLink({
  filters,
  value,
  label,
}: {
  filters: TaskColumnFilterValues;
  value: TaskTypeFilter;
  label: string;
}) {
  const active = filters.type === value;
  return (
    <Link
      href={taskHref({ ...filters, type: value })}
      className={`inline-flex h-8 items-center rounded-md border px-3 text-xs uppercase tracking-widest ${
        active
          ? "border-zinc-500 bg-zinc-900 text-zinc-100"
          : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {label}
    </Link>
  );
}

function taskHref(filters: TaskColumnFilterValues) {
  const params = new URLSearchParams();
  params.set("view", filters.view);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.client) params.set("client", filters.client);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.priority !== "all") params.set("priority", filters.priority);
  return `/admin/tasks?${params.toString()}`;
}

function typeLabel(type: TaskTypeFilter): string {
  if (type === "weekly") return TASK_TYPE_LABEL.weekly;
  if (type === "mom") return TASK_TYPE_LABEL.client_mom;
  return "all types";
}
