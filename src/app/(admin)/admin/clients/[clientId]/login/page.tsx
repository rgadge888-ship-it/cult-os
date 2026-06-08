import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "../invite-form";

export default async function ClientLoginPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: logins } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("client_id", clientId)
    .eq("role", "client");

  return <InviteForm clientId={clientId} existingLogins={logins ?? []} />;
}
