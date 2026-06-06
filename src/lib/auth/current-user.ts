import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, can, type Capability } from "@/lib/auth/permissions";
import type { Profile } from "@/lib/db/types";

// Loads the current authenticated user + their profile. Redirects to /login if not signed in.
// Optionally enforces role/capability guards.
export async function requireUser(opts?: {
  adminOnly?: boolean; // any team member (staff)
  clientOnly?: boolean;
  capability?: Capability; // require a specific capability, else redirect to /admin
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Profile row should be auto-created by the on_auth_user_created trigger.
    // If it's missing, force re-login rather than rendering a broken page.
    redirect("/login");
  }

  const p = profile as Profile;
  const isAdminSide = isStaff(p.role);

  if (opts?.adminOnly && !isAdminSide) redirect("/client");
  if (opts?.clientOnly && isAdminSide) redirect("/admin");
  if (opts?.capability && !can(p.role, opts.capability)) redirect("/admin");

  return { user, profile: p };
}

// Throw (instead of redirect) for use inside server actions.
export function assertCapability(role: Profile["role"], cap: Capability) {
  if (!can(role, cap)) {
    throw new Error("You don't have permission to do that.");
  }
}
