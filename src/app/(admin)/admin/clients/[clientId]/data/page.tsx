import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { MainsheetPreview, MainsheetTabMapping } from "../preview-tabs";
import type { Client } from "@/lib/db/types";

export default async function ClientDataSourcePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { user } = await requireUser({ adminOnly: true });
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, mainsheet_file_id, mainsheet_url, sheets_connected_at, tab_map")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const c = client as Pick<
    Client,
    "id" | "mainsheet_file_id" | "mainsheet_url" | "sheets_connected_at" | "tab_map"
  >;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader label="data source" className="mb-3" />
        <Panel className="space-y-2 p-5 text-sm">
          <Row
            label="Sheet URL"
            value={
              c.mainsheet_url ? (
                <a
                  href={c.mainsheet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-xs text-orange-400 underline-offset-2 hover:underline"
                >
                  {c.mainsheet_url}
                </a>
              ) : (
                <span className="text-zinc-500">not set</span>
              )
            }
          />
          <Row
            label="File ID"
            value={<span className="font-mono text-xs text-zinc-400">{c.mainsheet_file_id ?? "—"}</span>}
          />
          <Row
            label="Connected"
            value={
              <span className="font-mono text-xs text-zinc-400">
                {c.sheets_connected_at
                  ? new Date(c.sheets_connected_at).toLocaleString()
                  : "—"}
              </span>
            }
          />
        </Panel>
      </section>

      <MainsheetTabMapping
        userId={user.id}
        clientId={c.id}
        fileId={c.mainsheet_file_id}
        tabMap={c.tab_map ?? {}}
      />

      <MainsheetPreview
        userId={user.id}
        fileId={c.mainsheet_file_id}
      />
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="min-w-0 flex-1">{value}</div>
    </div>
  );
}
