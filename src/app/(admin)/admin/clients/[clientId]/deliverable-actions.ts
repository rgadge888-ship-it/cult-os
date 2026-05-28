"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { DeliverableStatus } from "@/lib/db/types";

export async function updateDeliverableStatus(
  deliverableId: string,
  clientId: string,
  status: DeliverableStatus,
) {
  const { user } = await requireUser({ adminOnly: true });
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
