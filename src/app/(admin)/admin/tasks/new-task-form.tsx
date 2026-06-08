"use client";

import { useActionState, useRef, useState } from "react";
import { createTask, type CreateTaskState } from "./actions";
import { TASK_TYPE_OPTIONS } from "@/lib/tasks";
import type { TaskType } from "@/lib/db/types";

const INITIAL: CreateTaskState = {};

export function NewTaskForm({
  clients,
  admins,
  defaultClientId,
  defaultTaskType = "weekly",
}: {
  clients: { id: string; name: string }[];
  admins: { id: string; label: string }[];
  defaultClientId?: string;
  defaultTaskType?: TaskType;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const action = async (prev: CreateTaskState, formData: FormData) => {
    const next = await createTask(prev, formData);
    if (next.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
    return next;
  };
  const [state, formAction, pending] = useActionState(action, INITIAL);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400"
      >
        + New task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-4"
      onReset={() => setOpen(false)}
    >
      <input
        name="title"
        required
        placeholder="Task title…"
        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        rows={2}
        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Type">
          <select
            name="task_type"
            defaultValue={defaultTaskType}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
          >
            {TASK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client">
          <select
            name="client_id"
            defaultValue={defaultClientId ?? ""}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assignee">
          <select
            name="assignee_id"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
          >
            <option value="">Unassigned</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            name="priority"
            defaultValue="medium"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Date added">
          <input
            name="added_date"
            type="date"
            defaultValue={todayInputValue()}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Due date">
          <input
            name="due_date"
            type="date"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
          />
        </Field>
      </div>
      {state.error ? (
        <p className="text-xs text-red-400">{state.error}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <button
          type="reset"
          className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
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
