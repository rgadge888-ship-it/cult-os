import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { DeliverableManage } from "../deliverable-manage";
import { DeliverableRow } from "../deliverable-row";
import type { Deliverable } from "@/lib/db/types";

export default async function ClientDeliverablesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order");

  const rows = (deliverables ?? []) as Deliverable[];
  const grouped = rows.reduce<Record<string, Deliverable[]>>((acc, row) => {
    const key = row.category ?? "Other";
    (acc[key] ??= []).push(row);
    return acc;
  }, {});
  const doneCount = rows.filter((row) => row.status === "done").length;

  return (
    <div>
      <SectionHeader
        label="deliverables"
        className="mb-3"
        action={
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {doneCount} / {rows.length}
          </span>
        }
      />
      <Panel className="divide-y divide-zinc-900">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="px-5 py-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {category}
            </p>
            <ul className="space-y-2">
              {items.map((item) => (
                <DeliverableRow
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  status={item.status}
                  clientId={clientId}
                />
              ))}
            </ul>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="px-6 pt-8 pb-2 text-center text-sm text-zinc-500">
            No deliverables. Optional — add them below if this client is in launch
            phase.
          </div>
        ) : null}
        <DeliverableManage clientId={clientId} isEmpty={rows.length === 0} />
      </Panel>
    </div>
  );
}
