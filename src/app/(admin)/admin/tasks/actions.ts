"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/permissions";
import type { TaskPriority, TaskStatus } from "@/lib/db/types";

export type CreateTaskState = { error?: string; ok?: number };

export async function createTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const { user, profile } = await requireUser({ adminOnly: true });
  if (!can(profile.role, "create_task")) {
    return { error: "You don't have permission to create tasks." };
  }
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const client_id = (String(formData.get("client_id") ?? "") || null) as string | null;
  const assignee_id =
    (String(formData.get("assignee_id") ?? "") || null) as string | null;
  const priority = (String(formData.get("priority") ?? "medium") as TaskPriority);
  const due_date = (String(formData.get("due_date") ?? "") || null) as string | null;

  const { error } = await supabase.from("tasks").insert({
    title,
    description,
    client_id: client_id || null,
    assignee_id: assignee_id || null,
    priority,
    due_date,
    created_by: user.id,
    source: "manual",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/tasks");
  if (client_id) revalidatePath(`/admin/clients/${client_id}`);
  return { ok: Date.now() };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { user } = await requireUser({ adminOnly: true });
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      completed_by: status === "done" ? user.id : null,
    })
    .eq("id", taskId);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/clients", "layout");
}

export async function updateTaskField(
  taskId: string,
  patch: Partial<{ assignee_id: string | null; priority: TaskPriority; due_date: string | null }>,
) {
  await requireUser({ adminOnly: true });
  const supabase = await createClient();
  await supabase.from("tasks").update(patch).eq("id", taskId);
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/clients", "layout");
}

export async function deleteTask(taskId: string) {
  const { profile } = await requireUser({ adminOnly: true });
  if (profile.role !== "super_admin") {
    throw new Error("Only the super admin can delete tasks.");
  }
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath("/admin/tasks");
}
