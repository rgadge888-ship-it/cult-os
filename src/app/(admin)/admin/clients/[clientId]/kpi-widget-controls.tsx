import { Plus, X } from "lucide-react";
import { addKpiWidget, removeKpiWidget } from "./kpi-widget-actions";
import type { FoundationKpi } from "@/lib/sheets/foundation";
import type { ClientKpiWidget } from "@/lib/db/types";

export function AddKpiWidgetControl({
  clientId,
  targets,
  selectedLabels,
}: {
  clientId: string;
  targets: FoundationKpi[];
  selectedLabels: Set<string>;
}) {
  const available = targets.filter((target) => !selectedLabels.has(target.label));
  const action = addKpiWidget.bind(null, clientId);

  return (
    <form action={action} className="flex items-center gap-2">
      <select
        name="kpi_label"
        disabled={available.length === 0}
        className="h-8 max-w-48 rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 focus:border-orange-500 focus:outline-none disabled:opacity-50"
      >
        {available.length === 0 ? (
          <option>No more KPIs</option>
        ) : (
          available.map((target) => (
            <option key={target.label} value={target.label}>
              {target.label}
            </option>
          ))
        )}
      </select>
      <button
        type="submit"
        disabled={available.length === 0}
        title="Add KPI widget"
        className="inline-flex size-8 items-center justify-center rounded border border-orange-500/50 bg-orange-950/20 text-orange-300 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden="true" />
        <span className="sr-only">Add KPI widget</span>
      </button>
    </form>
  );
}

export function RemoveKpiWidgetButton({
  clientId,
  widget,
}: {
  clientId: string;
  widget: ClientKpiWidget;
}) {
  const action = removeKpiWidget.bind(null, clientId, widget.id);
  return (
    <form action={action}>
      <button
        type="submit"
        title="Remove KPI widget"
        className="inline-flex size-7 items-center justify-center rounded border border-zinc-800 text-zinc-500 hover:border-red-500/60 hover:text-red-300"
      >
        <X className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Remove KPI widget</span>
      </button>
    </form>
  );
}
