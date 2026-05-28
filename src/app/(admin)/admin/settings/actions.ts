"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok?: number; error?: string };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const { user } = await requireUser({ adminOnly: true });
  const supabase = await createClient();
  const full_name = String(formData.get("full_name") ?? "").trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { ok: Date.now() };
}

export async function changePassword(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  await requireUser({ adminOnly: true });
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: Date.now() };
}
