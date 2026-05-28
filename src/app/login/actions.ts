"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Look up the user's role to decide where to land.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .single();

  const target =
    profile?.role === "super_admin" || profile?.role === "admin"
      ? "/admin"
      : "/client";

  redirect(target);
}
