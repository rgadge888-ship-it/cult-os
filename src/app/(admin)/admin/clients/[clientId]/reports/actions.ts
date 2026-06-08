"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, assertCapability } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { buildWeeklyReport } from "@/lib/reports/build-weekly";
import { parseDateRange } from "@/lib/reports/parse";
import { can } from "@/lib/auth/permissions";
import type { TaskPriority } from "@/lib/db/types";

export type GenerateState = { error?: string };

export async function generateWeeklyReport(
  clientId: string,
  prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  void prev;
  void formData;
  const { user, profile } = await requireUser({ adminOnly: true });
  if (!can(profile.role, "generate_report")) {
    return { error: "You don't have permission to generate reports." };
  }
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, mainsheet_file_id, tab_map")
    .eq("id", clientId)
    .single();

  if (!client?.mainsheet_file_id) {
    return { error: "This client has no Mainsheet linked." };
  }

  let data;
  try {
    data = await buildWeeklyReport(
      user.id,
      client.mainsheet_file_id,
      (client.tab_map ?? {}) as Record<string, string>,
    );
  } catch (e) {
    if (e instanceof Error && e.message === "google_not_connected") {
      return { error: "Google Sheets isn't connected. Connect it in Settings first." };
    }
    return { error: e instanceof Error ? e.message : "Failed to read the Mainsheet." };
  }

  // Derive the report week dates from the current range string.
  const parsed = parseDateRange(data.current.range);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = parsed?.start ?? today;
  const weekEnd = parsed?.end ?? today;

  const { data: report, error } = await supabase
    .from("weekly_reports")
    .upsert(
      {
        client_id: clientId,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        data,
        status: "draft",
        generated_by: user.id,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,week_start_date" },
    )
    .select("id")
    .single();

  if (error || !report) {
    return { error: error?.message ?? "Failed to save the report." };
  }

  await supabase.from("activity_log").insert({
    client_id: clientId,
    actor_id: user.id,
    action: "report.generated",
    subject_table: "weekly_reports",
    subject_id: report.id,
    metadata: { range: data.current.range },
    client_visible: false,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/reports`);
  redirect(`/admin/clients/${clientId}/reports/${report.id}`);
}

export type SaveTextState = { ok?: boolean; error?: string };

// Save the editable text blocks (narrative / discussion / MOM).
export async function saveReportText(
  reportId: string,
  clientId: string,
  prev: SaveTextState,
  formData: FormData,
): Promise<SaveTextState> {
  void prev;
  await requireUser({ adminOnly: true });
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_reports")
    .update({
      narrative: String(formData.get("narrative") ?? "").trim() || null,
      discussion: String(formData.get("discussion") ?? "").trim() || null,
      mom: String(formData.get("mom") ?? "").trim() || null,
    })
    .eq("id", reportId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/clients/${clientId}/reports/${reportId}`);
  revalidatePath(`/admin/clients/${clientId}/reports`);
  return { ok: true };
}

export async function publishReport(
  reportId: string,
  clientId: string,
  formData?: FormData,
) {
  void formData;
  const { user, profile } = await requireUser({ adminOnly: true });
  assertCapability(profile.role, "publish_report");
  const supabase = await createClient();
  await supabase
    .from("weekly_reports")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .eq("id", reportId);
  await supabase.from("activity_log").insert({
    client_id: clientId,
    actor_id: user.id,
    action: "report.published",
    subject_table: "weekly_reports",
    subject_id: reportId,
    client_visible: true,
  });
  revalidatePath(`/admin/clients/${clientId}/reports/${reportId}`);
  revalidatePath(`/admin/clients/${clientId}/reports`);
  revalidatePath(`/admin/clients/${clientId}`);
}

export type ExtractTasksState = { ok?: number; error?: string; count?: number };

export type DraftTask = {
  title: string;
  assignee_id: string | null;
  priority: TaskPriority;
  due_date: string | null;
};

// Create N tasks from a MOM extraction. All linked back to the source report.
export async function createTasksFromMom(
  reportId: string,
  clientId: string,
  tasks: DraftTask[],
): Promise<ExtractTasksState> {
  const { user, profile } = await requireUser({ adminOnly: true });
  if (!can(profile.role, "create_task")) {
    return { error: "You don't have permission to create tasks." };
  }
  const supabase = await createClient();

  const valid = tasks.filter((t) => t.title.trim().length > 0);
  if (valid.length === 0) return { error: "No tasks to create." };

  const rows = valid.map((t) => ({
    title: t.title.trim(),
    client_id: clientId,
    assignee_id: t.assignee_id || null,
    priority: t.priority,
    due_date: t.due_date || null,
    source: "from_mom" as const,
    task_type: "client_mom" as const,
    source_report_id: reportId,
    created_by: user.id,
  }));

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/admin/tasks");
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/tasks`);
  revalidatePath(`/admin/clients/${clientId}/reports/${reportId}`);
  return { ok: Date.now(), count: rows.length };
}

export async function unpublishReport(
  reportId: string,
  clientId: string,
  formData?: FormData,
) {
  void formData;
  const { user, profile } = await requireUser({ adminOnly: true });
  assertCapability(profile.role, "publish_report");
  const supabase = await createClient();
  await supabase
    .from("weekly_reports")
    .update({ status: "draft", published_at: null, published_by: null })
    .eq("id", reportId);
  await supabase.from("activity_log").insert({
    client_id: clientId,
    actor_id: user.id,
    action: "report.unpublished",
    subject_table: "weekly_reports",
    subject_id: reportId,
    client_visible: false,
  });
  revalidatePath(`/admin/clients/${clientId}/reports/${reportId}`);
  revalidatePath(`/admin/clients/${clientId}/reports`);
  revalidatePath(`/admin/clients/${clientId}`);
}
