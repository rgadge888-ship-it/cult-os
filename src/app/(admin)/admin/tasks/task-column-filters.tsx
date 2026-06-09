"use client";

import Link from "next/link";
import { useRef } from "react";
import { TASK_STATUS_OPTIONS, TASK_TYPE_OPTIONS } from "@/lib/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/db/types";

export type TaskColumnFilterValues = {
  view: string;
  type: "all" | "weekly" | "mom";
  status: TaskStatus | "all";
  client: string;
  assignee: string;
  priority: TaskPriority | "all";
};

export function TaskColumnFilters({
  values,
  clients,
  admins,
}: {
  values: TaskColumnFilterValues;
  clients: { id: string; name: string }[];
  admins: { id: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action="/admin/tasks"
      className="grid gap-2 border-b border-zinc-900 bg-zinc-950/40 px-4 py-3 sm:grid-cols-6"
    >
      <input type="hidden" name="view" value={values.view} />
      <FilterField label="Status">
        <select
          name="status"
          value={values.status}
          onChange={submit}
          className="h-8 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 focus:border-orange-500 focus:outline-none"
        >
          <option value="all">All statuses</option>
          {TASK_STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Type">
        <select
          name="type"
          value={values.type}
          onChange={submit}
          className="h-8 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 focus:border-orange-500 focus:outline-none"
        >
          <option value="all">All types</option>
          {TASK_TYPE_OPTIONS.map((type) => (
            <option key={type.value} value={type.value === "client_mom" ? "mom" : type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Client">
        <select
          name="client"
          value={values.client}
          onChange={submit}
          className="h-8 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 focus:border-orange-500 focus:outline-none"
        >
          <option value="">All clients</option>
          <option value="none">No client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Assignee">
        <select
          name="assignee"
          value={values.assignee}
          onChange={submit}
          className="h-8 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 focus:border-orange-500 focus:outline-none"
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.label}
            </option>
          ))}
        </select>
      </FilterField>
      <FilterField label="Priority">
        <select
          name="priority"
          value={values.priority}
          onChange={submit}
          className="h-8 w-full rounded border border-zinc-800 bg-zinc-950 px-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300 focus:border-orange-500 focus:outline-none"
        >
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </FilterField>
      <div className="flex items-end">
        <Link
          href="/admin/tasks?view=all"
          className="inline-flex h-8 w-full items-center justify-center rounded border border-zinc-800 px-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
        >
          Clear filters
        </Link>
      </div>
    </form>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-700">
        {label}
      </span>
      {children}
    </label>
  );
}
