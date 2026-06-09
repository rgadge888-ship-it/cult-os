"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteTask, updateTaskDetails, updateTaskStatus, updateTaskField } from "./actions";
import { TASK_STATUS_OPTIONS, TASK_TYPE_LABEL, TASK_TYPE_OPTIONS } from "@/lib/tasks";
import type { TaskPriority, TaskStatus, TaskType } from "@/lib/db/types";

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
  task_type: TaskType;
  due_date: string | null;
  created_at: string;
  assignee_id: string | null;
  client_id: string | null;
  client_name: string | null;
  assignee_name: string | null;
};

export function TaskRow({
  task,
  admins,
  clients,
  canDelete,
}: {
  task: TaskRowData;
  admins: { id: string; label: string }[];
  clients: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function onDelete() {
    const ok = window.confirm(`Delete task "${task.title}"? This cannot be undone.`);
    if (!ok) return;
    start(async () => {
      await deleteTask(task.id);
    });
  }

  function onSave(formData: FormData) {
    setError(null);
    start(async () => {
      try {
        await updateTaskDetails(task.id, formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update task.");
      }
    });
  }

  if (editing) {
    return (
      <li
        className={`border-b border-zinc-900/60 px-4 py-4 last:border-b-0 ${
          pending ? "opacity-60" : ""
        }`}
      >
        <form action={onSave} className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <Field label="Task">
              <input
                name="title"
                required
                defaultValue={task.title}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
              />
            </Field>
            <Field label="Status">
              <select
                name="status"
                defaultValue={task.status}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                name="task_type"
                defaultValue={task.task_type}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
              >
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                name="priority"
                defaultValue={task.priority}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              name="description"
              defaultValue={task.description ?? ""}
              rows={2}
              className="w-full resize-y rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
            />
          </Field>
          <div className="grid gap-3 lg:grid-cols-5">
            <Field label="Client">
              <select
                name="client_id"
                defaultValue={task.client_id ?? ""}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assignee">
              <select
                name="assignee_id"
                defaultValue={task.assignee_id ?? ""}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date added">
              <input
                name="added_date"
                type="date"
                defaultValue={dateInputValue(task.created_at)}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
              />
            </Field>
            <Field label="Due date">
              <input
                name="due_date"
                type="date"
                defaultValue={task.due_date ?? ""}
                className="h-9 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
              />
            </Field>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center gap-2 rounded border border-emerald-600/50 bg-emerald-950/20 px-3 font-mono text-[10px] uppercase tracking-widest text-emerald-300 hover:border-emerald-500 disabled:opacity-50"
              >
                <Check className="size-3.5" aria-hidden="true" />
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEditing(false);
                }}
                disabled={pending}
                className="inline-flex h-9 items-center gap-2 rounded border border-zinc-800 px-3 font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:border-zinc-600 disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden="true" />
                Cancel
              </button>
            </div>
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </form>
      </li>
    );
  }

  return (
    <li
      className={`grid grid-cols-12 items-center gap-3 border-b border-zinc-900/60 px-4 py-3 last:border-b-0 hover:bg-zinc-950/40 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <select
        value={task.status}
        onChange={(e) => start(() => updateTaskStatus(task.id, e.target.value as TaskStatus))}
        className={`col-span-2 h-8 rounded border bg-zinc-950 px-2 font-mono text-[10px] uppercase tracking-widest focus:border-orange-500 focus:outline-none ${
          STATUS_COLOR[task.status]
        }`}
      >
        {TASK_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="col-span-3 min-w-0">
        <p className="truncate text-sm text-zinc-100">{task.title}</p>
        {task.description ? (
          <p className="truncate text-xs text-zinc-500">{task.description}</p>
        ) : null}
      </div>

      <div className="col-span-1">
        <span className="rounded border border-zinc-800 px-1.5 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {TASK_TYPE_LABEL[task.task_type]}
        </span>
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

      <div className="col-span-2 grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-right font-mono text-[11px]">
        <div className="text-zinc-500" title={task.created_at}>
          <span className="block text-[9px] uppercase tracking-widest text-zinc-700">
            Added
          </span>
          {formatDate(task.created_at)}
        </div>
        <div className={dueClass} title={task.due_date ?? ""}>
          <span className="block text-[9px] uppercase tracking-widest text-zinc-700">
            Due
          </span>
          {task.due_date ? formatDate(task.due_date) : "—"}{" "}
          <span className={`ml-1 ${PRIORITY_COLOR[task.priority]}`}>•</span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          title="Edit task"
          className="mt-3 inline-flex size-7 items-center justify-center rounded border border-zinc-800 text-zinc-500 hover:border-orange-500/60 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Edit task</span>
        </button>
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            title="Delete task"
            className="mt-3 inline-flex size-7 items-center justify-center rounded border border-zinc-800 text-zinc-500 hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Delete task</span>
          </button>
        ) : null}
      </div>
    </li>
  );
}

function dateInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = d.toLocaleString("en-IN", { month: "short" });
  return `${m} ${d.getDate()}`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        {label}
      </span>
      {children}
    </label>
  );
}
