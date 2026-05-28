"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTask, type CreateTaskState } from "./actions";

const INITIAL: CreateTaskState = {};

export function NewTaskForm({
  clients,
  admins,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  admins: { id: string; label: string }[];
  defaultClientId?: string;
}) {
  const [state, action, pending] = useActionState(createTask, INITIAL);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-close + clear inputs on each successful submit. state.ok is a
  // timestamp so the effect fires on every distinct success, not just the first.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

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
      action={action}
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
      <div className="grid gap-3 sm:grid-cols-4">
        <select
          name="client_id"
          defaultValue={defaultClientId ?? ""}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
        >
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="assignee_id"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
        >
          <option value="">Unassigned</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue="medium"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input
          name="due_date"
          type="date"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
        />
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
