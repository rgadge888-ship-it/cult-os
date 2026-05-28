"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateProfile, changePassword, type ProfileState } from "./actions";

const INITIAL: ProfileState = {};

export function FullNameEditor({ initial }: { initial: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  if (!editing) {
    return (
      <span className="flex items-center gap-3">
        <span className="text-zinc-300">{initial ?? "—"}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-orange-400"
        >
          edit
        </button>
      </span>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="full_name"
        defaultValue={initial ?? ""}
        autoFocus
        className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-7 items-center rounded-md bg-orange-500 px-3 text-[10px] uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:opacity-60"
      >
        {pending ? "saving…" : "save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        cancel
      </button>
      {state.error ? (
        <span className="text-xs text-red-400">{state.error}</span>
      ) : null}
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, INITIAL);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase tracking-widest text-zinc-500">
          New password
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="at least 8 characters"
          className="w-full max-w-sm rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-200 hover:border-zinc-500 disabled:opacity-60"
        >
          {pending ? "Updating…" : "Change password"}
        </button>
        {state.ok ? (
          <span className="text-xs text-emerald-400">password updated</span>
        ) : null}
        {state.error ? (
          <span className="text-xs text-red-400">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
