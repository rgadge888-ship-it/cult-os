import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

// Loads the current authenticated user + their profile. Redirects to /login if not signed in.
// Optionally enforces a role guard (e.g. require admin or super_admin).
export async function requireUser(opts?: { adminOnly?: boolean; clientOnly?: boolean }) {
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

  const isAdminSide = profile.role === "super_admin" || profile.role === "admin";

  if (opts?.adminOnly && !isAdminSide) redirect("/client");
  if (opts?.clientOnly && isAdminSide) redirect("/admin");

  return { user, profile: profile as Profile };
}
