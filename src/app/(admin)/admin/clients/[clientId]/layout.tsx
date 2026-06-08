import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/ui/status-pill";
import { ClientWorkspaceNav } from "./workspace-nav";
import type { Client } from "@/lib/db/types";

export default async function ClientWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireUser({ adminOnly: true });
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, slug, niche, status, plan")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const c = client as Pick<Client, "id" | "name" | "slug" | "niche" | "status" | "plan">;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <Link
        href="/admin/clients"
        className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        ← Clients
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
            ► client · {c.slug}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            {c.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            {c.niche ? <span>{c.niche}</span> : null}
            <StatusPill status={c.status} />
            <span className="font-mono text-xs text-zinc-600">
              {c.plan === "three_month" ? "3-month plan" : "1-month plan"}
            </span>
          </div>
        </div>
      </div>

      <ClientWorkspaceNav clientId={clientId} />

      <div className="mt-8">{children}</div>
    </div>
  );
}
