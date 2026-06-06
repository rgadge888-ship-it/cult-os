"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { inviteAdmin, type InviteAdminState } from "./actions";

const INITIAL: InviteAdminState = {};

export function InviteAdminForm() {
  const [state, action, pending] = useActionState(inviteAdmin, INITIAL);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400"
      >
        + Invite teammate
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
      {state.ok ? (
        <div className="space-y-2">
          <p className="text-sm text-emerald-300">Teammate login created.</p>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex gap-2">
              <span className="text-zinc-500">email</span>
              <span className="text-zinc-200">{state.email}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500">temp password</span>
              <span className="select-all text-orange-300">{state.tempPassword}</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            Share securely. Ask them to change it after first login. Assign clients below.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-[10px] uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
          >
            Done
          </button>
        </div>
      ) : (
        <form ref={formRef} action={action} className="space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="teammate@cultmarketers.com"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
          />
          <input
            name="full_name"
            placeholder="Full name (e.g. Kundan)"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
          />
          {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create login"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
