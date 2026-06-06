"use server";

import { revalidatePath } from "next/cache";
import { requireUser, assertCapability } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { DeliverableStatus } from "@/lib/db/types";

export async function updateDeliverableStatus(
  deliverableId: string,
  clientId: string,
  status: DeliverableStatus,
) {
  const { user, profile } = await requireUser({ adminOnly: true });
  assertCapability(profile.role, "manage_deliverables");
  const supabase = await createClient();

  await supabase
    .from("deliverables")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      completed_by: status === "done" ? user.id : null,
    })
    .eq("id", deliverableId);

  await supabase.from("activity_log").insert({
    client_id: clientId,
    actor_id: user.id,
    action: status === "done" ? "deliverable.completed" : "deliverable.status_changed",
    subject_table: "deliverables",
    subject_id: deliverableId,
    metadata: { status },
    client_visible: status === "done",
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/client/deliverables");
  revalidatePath("/client");
}

export type AddDeliverableState = { error?: string; ok?: boolean };

// Add a single deliverable manually. Optional category groups it in the UI.
export async function addDeliverable(
  clientId: string,
  _prev: AddDeliverableState,
  formData: FormData,
): Promise<AddDeliverableState> {
  const { profile } = await requireUser({ adminOnly: true });
  assertCapability(profile.role, "manage_deliverables");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a deliverable name." };
  const category = String(formData.get("category") ?? "").trim() || null;

  const supabase = await createClient();
  // Place new item at the end.
  const { data: last } = await supabase
    .from("deliverables")
    .select("sort_order")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = (last?.sort_order ?? 0) + 10;

  const { error } = await supabase.from("deliverables").insert({
    client_id: clientId,
    name,
    category,
    sort_order: sort,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/client/deliverables");
  revalidatePath("/client");
  return { ok: true };
}

export async function deleteDeliverable(deliverableId: string, clientId: string) {
  const { profile } = await requireUser({ adminOnly: true });
  assertCapability(profile.role, "manage_deliverables");
  const supabase = await createClient();
  await supabase.from("deliverables").delete().eq("id", deliverableId);
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/client/deliverables");
  revalidatePath("/client");
}

// One-click: load the standard launch checklist (the old 21-item template).
// For brand-new clients still in launch phase.
export async function loadLaunchChecklist(clientId: string) {
  const { profile } = await requireUser({ adminOnly: true });
  assertCapability(profile.role, "manage_deliverables");
  const supabase = await createClient();
  const { error } = await supabase.rpc("seed_default_deliverables", {
    p_client_id: clientId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/client/deliverables");
  revalidatePath("/client");
  return { ok: true };
}
