"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function genPassword(): string {
  return randomBytes(9).toString("base64url") + "A1!";
}

async function ensureSuperAdmin() {
  const { profile } = await requireUser({ adminOnly: true });
  if (profile.role !== "super_admin") {
    throw new Error("Only the super admin can manage the team.");
  }
  return profile;
}

export type InviteAdminState = {
  ok?: boolean;
  email?: string;
  tempPassword?: string;
  error?: string;
};

// Create a new admin (team member) login.
export async function inviteAdmin(
  _prev: InviteAdminState,
  formData: FormData,
): Promise<InviteAdminState> {
  let actor;
  try {
    actor = await ensureSuperAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!email || !email.includes("@")) return { error: "Enter a valid email." };

  const admin = createAdminClient();
  const tempPassword = genPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });
  if (createErr || !created.user) {
    if (createErr?.message?.toLowerCase().includes("already")) {
      return { error: "A user with that email already exists." };
    }
    return { error: createErr?.message ?? "Failed to create login." };
  }

  // Trigger created a profile (role=client by default). Promote to admin.
  const { error: profErr } = await admin
    .from("profiles")
    .update({ role: "admin", full_name: fullName || email.split("@")[0] })
    .eq("id", created.user.id);
  if (profErr) return { error: `Created but role update failed: ${profErr.message}` };

  await admin.from("activity_log").insert({
    actor_id: actor.id,
    action: "team.admin_created",
    subject_table: "profiles",
    subject_id: created.user.id,
    metadata: { email },
    client_visible: false,
  });

  revalidatePath("/admin/team");
  return { ok: true, email, tempPassword };
}

// Assign / unassign a client to an admin.
export async function setAssignment(
  adminId: string,
  clientId: string,
  assigned: boolean,
) {
  const actor = await ensureSuperAdmin();
  const admin = createAdminClient();
  if (assigned) {
    await admin
      .from("client_admins")
      .upsert(
        { admin_id: adminId, client_id: clientId, assigned_by: actor.id },
        { onConflict: "client_id,admin_id" },
      );
  } else {
    await admin
      .from("client_admins")
      .delete()
      .eq("admin_id", adminId)
      .eq("client_id", clientId);
  }
  revalidatePath("/admin/team");
}

export type ResetAdminState = {
  ok?: boolean;
  email?: string;
  tempPassword?: string;
  error?: string;
};

export async function resetAdminPassword(
  adminId: string,
  _prev: ResetAdminState,
  _fd: FormData,
): Promise<ResetAdminState> {
  try {
    await ensureSuperAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed." };
  }
  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(adminId);
  if (!target.user) return { error: "User not found." };
  const tempPassword = genPassword();
  const { error } = await admin.auth.admin.updateUserById(adminId, {
    password: tempPassword,
  });
  if (error) return { error: error.message };
  return { ok: true, email: target.user.email ?? "", tempPassword };
}

export async function removeAdmin(adminId: string) {
  const actor = await ensureSuperAdmin();
  if (adminId === actor.id) throw new Error("You can't remove yourself.");
  const admin = createAdminClient();
  // Deleting the auth user cascades to profile + client_admins.
  await admin.auth.admin.deleteUser(adminId);
  revalidatePath("/admin/team");
}
