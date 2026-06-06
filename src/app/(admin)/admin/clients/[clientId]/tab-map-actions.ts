"use server";

import { revalidatePath } from "next/cache";
import { requireUser, assertCapability } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { TAB_ROLES, type TabMap } from "@/lib/sheets/tabs";

export type SaveTabMapState = { ok?: boolean; error?: string };

export async function saveTabMap(
  clientId: string,
  _prev: SaveTabMapState,
  formData: FormData,
): Promise<SaveTabMapState> {
  const { profile } = await requireUser({ adminOnly: true });
  assertCapability(profile.role, "sheet_setup");
  const supabase = await createClient();

  const map: TabMap = {};
  for (const { role } of TAB_ROLES) {
    const v = String(formData.get(`tab_${role}`) ?? "").trim();
    if (v) map[role] = v;
  }

  const { error } = await supabase
    .from("clients")
    .update({ tab_map: map })
    .eq("id", clientId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true };
}
