import type { Credentials } from "google-auth-library";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoredTokens = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: string | null;
  scope: string | null;
  token_type: string;
  updated_at: string;
};

export async function saveTokensForUser(userId: string, tokens: Credentials) {
  if (!tokens.access_token) throw new Error("missing access_token");
  const supabase = createAdminClient();
  const { error } = await supabase.from("google_oauth_tokens").upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expiry_date: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? "Bearer",
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function getTokensForUser(
  userId: string,
): Promise<StoredTokens | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as StoredTokens | null;
}

export async function deleteTokensForUser(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("google_oauth_tokens")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
