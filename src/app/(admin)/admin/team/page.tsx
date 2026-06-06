import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Panel, SectionHeader } from "@/components/ui/section";
import { InviteAdminForm } from "./invite-admin-form";
import { AdminCard } from "./admin-card";

export default async function TeamPage() {
  const { profile } = await requireUser({ adminOnly: true });
  if (profile.role !== "super_admin") redirect("/admin");

  // Service-role read: team management needs to see all admins + all
  // assignments regardless of the assigned-client RLS scoping.
  const admin = createAdminClient();
  const supabase = await createClient();

  const [{ data: admins }, { data: clients }, { data: assignments }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, email, full_name, role")
        .in("role", ["super_admin","strategist","automation","copywriter","admin"])
        .order("role", { ascending: false })
        .order("email"),
      supabase.from("clients").select("id, name").order("name"),
      admin.from("client_admins").select("admin_id, client_id"),
    ]);

  const byAdmin = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const arr = byAdmin.get(a.admin_id) ?? [];
    arr.push(a.client_id);
    byAdmin.set(a.admin_id, arr);
  }

  const clientList = (clients ?? []) as { id: string; name: string }[];
  const adminList = (admins ?? []) as {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
  }[];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
            ► team
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Team & access
          </h1>
          <p className="text-sm text-zinc-500">
            add teammates · assign which clients each one can see
          </p>
        </div>
        <InviteAdminForm />
      </div>

      <div className="mt-8">
        <SectionHeader
          label={`members · ${adminList.length}`}
          className="mb-3"
        />
        <div className="space-y-4">
          {adminList.map((a) => (
            <AdminCard
              key={a.id}
              admin={a}
              clients={clientList}
              assignedClientIds={byAdmin.get(a.id) ?? []}
              isSelf={a.id === profile.id}
            />
          ))}
        </div>
      </div>

      <Panel className="mt-8 p-5 text-xs text-zinc-500">
        <p className="text-zinc-400">How access works</p>
        <ul className="mt-2 space-y-1">
          <li>· Super admin (you) sees every client + manages this page.</li>
          <li>· Admins see only the clients you toggle on for them.</li>
          <li>· Tasks assigned to an admin are always visible to them, even across clients.</li>
          <li>· Enforced at the database level — an admin literally cannot query unassigned clients.</li>
        </ul>
      </Panel>
    </div>
  );
}
