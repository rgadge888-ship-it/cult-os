import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { can } from "@/lib/auth/permissions";
import type { Client } from "@/lib/db/types";

export default async function ClientsListPage() {
  const { profile } = await requireUser({ adminOnly: true });
  const canCreate = can(profile.role, "create_client");
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, slug, niche, plan, status, monthly_ad_budget_inr, mainsheet_file_id, created_at")
    .order("created_at", { ascending: false });

  const rows = (clients ?? []) as Pick<
    Client,
    "id" | "name" | "slug" | "niche" | "plan" | "status" | "monthly_ad_budget_inr" | "mainsheet_file_id" | "created_at"
  >[];

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
            ► roster
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Clients
          </h1>
          <p className="text-sm text-zinc-500">
            every coaching business under Cult Marketers. {rows.length} total.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/admin/clients/new"
            className="inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-medium text-zinc-950 hover:bg-orange-400"
          >
            + New client
          </Link>
        ) : null}
      </div>

      <div className="mt-10">
        <SectionHeader label="all clients" className="mb-3" />
        <Panel>
          {rows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-zinc-600">
                no clients yet
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                create your first client to start tracking leads, deliverables, and reports.
              </p>
              <Link
                href="/admin/clients/new"
                className="mt-5 inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
              >
                + Create client
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="px-4 py-3 text-left font-normal">Name</th>
                  <th className="px-4 py-3 text-left font-normal">Niche</th>
                  <th className="px-4 py-3 text-right font-normal">Sheet</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-zinc-900/60 last:border-b-0 hover:bg-zinc-900/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="text-zinc-100 hover:text-orange-400"
                      >
                        {c.name}
                      </Link>
                      <div className="font-mono text-[10px] text-zinc-600">{c.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{c.niche ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {c.mainsheet_file_id ? (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                          linked
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
