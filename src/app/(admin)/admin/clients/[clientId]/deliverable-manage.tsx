"use client";

import { useActionState, useRef, useEffect, useTransition } from "react";
import {
  addDeliverable,
  loadLaunchChecklist,
  type AddDeliverableState,
} from "./deliverable-actions";

const INITIAL: AddDeliverableState = {};

export function DeliverableManage({
  clientId,
  isEmpty,
}: {
  clientId: string;
  isEmpty: boolean;
}) {
  const add = addDeliverable.bind(null, clientId);
  const [state, action, pending] = useActionState(add, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-3 border-t border-zinc-900 px-5 py-4">
      <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
        <input
          name="name"
          required
          placeholder="Add a deliverable…"
          className="h-9 flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
        />
        <input
          name="category"
          placeholder="Category (optional)"
          className="h-9 w-44 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}

      {isEmpty ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">New client in launch phase?</span>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              startLoad(async () => {
                await loadLaunchChecklist(clientId);
              })
            }
            className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-[10px] uppercase tracking-widest text-zinc-300 hover:border-orange-500 hover:text-orange-300 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load launch checklist (21 items)"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
