import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// Helper for client-portal pages: resolve the current client's record + their
// linked Mainsheet file id. Throws via requireUser if the caller isn't a client.
export async function getCurrentClientContext() {
  const { profile } = await requireUser({ clientOnly: true });
  const supabase = await createClient();
  if (!profile.client_id) {
    return { profile, client: null };
  }
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, mainsheet_file_id, mainsheet_url, tab_map")
    .eq("id", profile.client_id)
    .single();
  return { profile, client };
}
