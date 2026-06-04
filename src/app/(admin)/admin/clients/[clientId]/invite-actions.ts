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

  // Either create the user or, if the email is already in auth.users, fetch
  // them. Either way we end up with a userId we can link to the profile.
  let userId: string | null = null;
  let reused = false;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName || client.name },
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (
    createErr?.message?.toLowerCase().includes("already") ||
    createErr?.message?.toLowerCase().includes("exists")
  ) {
    // Email already registered. Find the existing user and reset their
    // password so the admin still gets a shareable credential.
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing?.id) {
      const existingId: string = existing.id;
      userId = existingId;
      reused = true;
      const { error: pwErr } = await admin.auth.admin.updateUserById(existingId, {
        password: tempPassword,
      });
      if (pwErr) return { error: `Linking existing user failed: ${pwErr.message}` };
    } else {
      return {
        error: "User exists in auth but has no profile row — please reset via Supabase dashboard.",
      };
    }
  } else {
    return { error: createErr?.message ?? "Failed to create login." };
  }

  if (!userId) return { error: "Failed to resolve user id." };

  // Idempotent: ensure the profile row exists AND is linked to this client
  // with role=client. Upsert handles both fresh users and edge cases where
  // the trigger didn't fire.
  const { error: upsertErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      role: "client",
      client_id: clientId,
      full_name: fullName || client.name,
    },
    { onConflict: "id" },
  );

  if (upsertErr) {
    return { error: `Login created but linking failed: ${upsertErr.message}` };
  }

  await admin.from("activity_log").insert({
    client_id: clientId,
    actor_id: profile.id,
    action: reused ? "client.login_linked" : "client.login_created",
    subject_table: "profiles",
    subject_id: userId,
    metadata: { email, reused },
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
