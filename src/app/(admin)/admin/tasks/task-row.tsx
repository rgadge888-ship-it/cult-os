"use client";

import { useTransition } from "react";
import { updateTaskStatus, updateTaskField } from "./actions";
import type { TaskStatus, TaskPriority } from "@/lib/db/types";

const STATUS_CYCLE: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "TODO",
  in_progress: "DOING",
  blocked: "BLOCKED",
  done: "DONE",
};
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "border-zinc-700 text-zinc-300",
  in_progress: "border-orange-500/60 text-orange-300 bg-orange-950/30",
  blocked: "border-red-700/60 text-red-300 bg-red-950/30",
  done: "border-emerald-700/60 text-emerald-300 bg-emerald-950/30 line-through",
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "text-zinc-500",
  medium: "text-zinc-300",
  high: "text-amber-400",
  urgent: "text-red-400",
};

export type TaskRowData = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  client_id: string | null;
  client_name: string | null;
  assignee_name: string | null;
};

export function TaskRow({
  task,
  admins,
}: {
  task: TaskRowData;
  admins: { id: string; label: string }[];
}) {
  const [pending, start] = useTransition();

  const cycleStatus = () => {
    const i = STATUS_CYCLE.indexOf(task.status);
    const next = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
    start(() => updateTaskStatus(task.id, next));
  };

  const dueClass = (() => {
    if (!task.due_date) return "text-zinc-600";
    const d = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (task.status === "done") return "text-zinc-600";
    if (d < today) return "text-red-400";
    const diff = (d.getTime() - today.getTime()) / 86400000;
    if (diff <= 2) return "text-amber-400";
    return "text-zinc-400";
  })();

  return (
    <li
      className={`grid grid-cols-12 items-center gap-3 border-b border-zinc-900/60 px-4 py-3 last:border-b-0 hover:bg-zinc-950/40 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        onClick={cycleStatus}
        className={`col-span-2 inline-flex h-7 items-center justify-center rounded border px-2 font-mono text-[10px] tracking-widest ${
          STATUS_COLOR[task.status]
        }`}
        title="click to advance status"
      >
        {STATUS_LABEL[task.status]}
      </button>

      <div className="col-span-5 min-w-0">
        <p className="truncate text-sm text-zinc-100">{task.title}</p>
        {task.description ? (
          <p className="truncate text-xs text-zinc-500">{task.description}</p>
        ) : null}
      </div>

      <div className="col-span-2 truncate font-mono text-xs text-zinc-400">
        {task.client_name ?? "—"}
      </div>

      <select
        defaultValue={task.assignee_id ?? ""}
        onChange={(e) =>
          start(() =>
            updateTaskField(task.id, { assignee_id: e.target.value || null }),
          )
        }
        className="col-span-2 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
      >
        <option value="">unassigned</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>

      <div
        className={`col-span-1 text-right font-mono text-xs ${dueClass}`}
        title={task.due_date ?? ""}
      >
        {task.due_date ? formatDue(task.due_date) : "—"}{" "}
        <span className={`ml-1 ${PRIORITY_COLOR[task.priority]}`}>•</span>
      </div>
    </li>
  );
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  const m = d.toLocaleString("en-IN", { month: "short" });
  return `${m} ${d.getDate()}`;
}
