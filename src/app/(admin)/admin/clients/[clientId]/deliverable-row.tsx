"use client";

import { useTransition } from "react";
import { updateDeliverableStatus } from "./deliverable-actions";
import type { DeliverableStatus } from "@/lib/db/types";

const CYCLE: DeliverableStatus[] = ["not_started", "in_progress", "done", "blocked"];
const LABEL: Record<DeliverableStatus, string> = {
  not_started: "TODO",
  in_progress: "DOING",
  done: "DONE",
  blocked: "BLOCKED",
};
const STYLE: Record<DeliverableStatus, string> = {
  not_started: "border-zinc-700 text-zinc-300",
  in_progress: "border-orange-500/60 text-orange-300 bg-orange-950/30",
  done: "border-emerald-700/60 text-emerald-300 bg-emerald-950/30",
  blocked: "border-red-700/60 text-red-300 bg-red-950/30",
};

export function DeliverableRow({
  id,
  name,
  status,
  clientId,
}: {
  id: string;
  name: string;
  status: DeliverableStatus;
  clientId: string;
}) {
  const [pending, start] = useTransition();
  const cycle = () => {
    const i = CYCLE.indexOf(status);
    const next = CYCLE[(i + 1) % CYCLE.length];
    start(() => updateDeliverableStatus(id, clientId, next));
  };
  return (
    <li
      className={`flex items-center justify-between gap-3 text-sm ${
        pending ? "opacity-60" : ""
      }`}
    >
      <span className={status === "done" ? "text-zinc-500 line-through" : "text-zinc-200"}>
        {name}
      </span>
      <button
        type="button"
        onClick={cycle}
        title="click to advance"
        className={`inline-flex h-7 items-center justify-center rounded border px-2 font-mono text-[10px] tracking-widest ${STYLE[status]}`}
      >
        {LABEL[status]}
      </button>
    </li>
  );
}
