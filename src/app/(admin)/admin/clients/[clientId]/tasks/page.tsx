import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { NewTaskForm } from "../../../tasks/new-task-form";
import { TaskRow, type TaskRowData } from "../../../tasks/task-row";
import type { Client, Task } from "@/lib/db/types";

export default async function ClientTasksPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [
    { data: client },
    { data: clientTasks },
    { data: allClients },
    { data: allAdmins },
  ] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).single(),
    supabase
      .from("tasks")
      .select("*")
      .eq("client_id", clientId)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase.from("clients").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["super_admin", "strategist", "automation", "copywriter", "admin"])
      .order("email"),
  ]);

  if (!client) notFound();

  const c = client as Pick<Client, "id" | "name">;
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
    task_type: t.task_type,
    due_date: t.due_date,
    created_at: t.created_at,
    assignee_id: t.assignee_id,
    client_id: t.client_id,
    client_name: c.name,
    assignee_name: t.assignee_id ? adminMap.get(t.assignee_id) ?? null : null,
  }));

  return (
    <div>
      <SectionHeader
        label="client tasks"
        className="mb-3"
        action={
          <NewTaskForm
            clients={allClients ?? []}
            admins={adminOptions}
            defaultClientId={c.id}
            defaultTaskType="client_mom"
          />
        }
      />
      <Panel>
        {taskRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            No tasks for this client yet. Add one above, or extract from a report MOM.
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-12 gap-3 border-b border-zinc-900 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600 sm:grid">
              <span className="col-span-2">Status</span>
              <span className="col-span-3">Task</span>
              <span className="col-span-1">Type</span>
              <span className="col-span-2">Client</span>
              <span className="col-span-2">Assignee</span>
              <span className="col-span-2 text-right">Added · due</span>
            </div>
            <ul>
              {taskRows.map((t) => (
                <TaskRow key={t.id} task={t} admins={adminOptions} />
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
