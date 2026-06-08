import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import type { Deliverable } from "@/lib/db/types";

export default async function ClientDeliverablesPage() {
  await requireUser({ clientOnly: true });
  const supabase = await createClient();

  // RLS scopes to the client's own deliverables.
  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*")
    .order("sort_order");

  const d = (deliverables ?? []) as Deliverable[];
  const grouped = d.reduce<Record<string, Deliverable[]>>((acc, row) => {
    const key = row.category ?? "Other";
    (acc[key] ??= []).push(row);
    return acc;
  }, {});
  const done = d.filter((x) => x.status === "done").length;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► deliverables
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          What we have built for you
        </h1>
        <p className="text-sm text-zinc-500">
          everything included in your engagement · {done}/{d.length} done
        </p>
      </div>

      <div className="mt-8">
        <SectionHeader label="checklist" className="mb-3" />
        <Panel className="divide-y divide-zinc-900">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="px-5 py-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                {category}
              </p>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-zinc-200">{item.name}</span>
                    <StatusPill status={item.status} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {d.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              Your deliverables checklist is being set up.
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
