"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteState = {
  ok?: boolean;
  email?: string;
  tempPassword?: string;
  error?: string;
};

// Generate a readable-but-strong temporary password.
function genPassword(): string {
  return randomBytes(9).toString("base64url") + "A1!";
}

// Create a client-role login for a coaching client. Super-admin only.
export async function createClientLogin(
  clientId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { profile } = await requireUser({ adminOnly: true });
  if (profile.role !== "super_admin") {
    return { error: "Only the super admin can create client logins." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();
  if (!client) return { error: "Client not found." };

  const admin = createAdminClient();
  const tempPassword = genPassword();

  // Create the auth user (auto-confirmed so they can log in immediately).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName || client.name },
  });

  if (createErr || !created.user) {
    if (createErr?.message?.toLowerCase().includes("already")) {
      return { error: "A user with that email already exists." };
    }
    return { error: createErr?.message ?? "Failed to create login." };
  }

  // The on_auth_user_created trigger created a profile row. Link it to this
  // client and ensure role = client. Use service role to bypass RLS.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      role: "client",
      client_id: clientId,
      full_name: fullName || client.name,
    })
    .eq("id", created.user.id);

  if (profileErr) {
    return { error: `Login created but linking failed: ${profileErr.message}` };
  }

  await admin.from("activity_log").insert({
    client_id: clientId,
    actor_id: profile.id,
    action: "client.login_created",
    subject_table: "profiles",
    subject_id: created.user.id,
    metadata: { email },
    client_visible: false,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, email, tempPassword };
}

export type ResetState = {
  ok?: boolean;
  email?: string;
  tempPassword?: string;
  error?: string;
};

// Reset password for any user (client login or admin). Super-admin only.
// Returns a fresh temp password to share with the user out-of-band.
export async function resetUserPassword(
  clientId: string,
  userId: string,
  _prev: ResetState,
  _fd: FormData,
): Promise<ResetState> {
  const { profile } = await requireUser({ adminOnly: true });
  if (profile.role !== "super_admin") {
    return { error: "Only the super admin can reset passwords." };
  }

  const admin = createAdminClient();

  // Look up the target user to confirm + get email for display.
  const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !target.user) {
    return { error: getErr?.message ?? "User not found." };
  }

  const tempPassword = genPassword();
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (updErr) {
    return { error: updErr.message };
  }

  await admin.from("activity_log").insert({
    client_id: clientId,
    actor_id: profile.id,
    action: "client.password_reset",
    subject_table: "profiles",
    subject_id: userId,
    metadata: { email: target.user.email },
    client_visible: false,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true, email: target.user.email ?? "", tempPassword };
}
