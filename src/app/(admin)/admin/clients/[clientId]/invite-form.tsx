"use client";

import { useActionState } from "react";
import { createClientLogin, type InviteState } from "./invite-actions";
import { Panel, SectionHeader } from "@/components/ui/section";

const INITIAL: InviteState = {};

export function InviteForm({
  clientId,
  existingLogins,
}: {
  clientId: string;
  existingLogins: { email: string; full_name: string | null }[];
}) {
  const action = createClientLogin.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <div>
      <SectionHeader label="client login" className="mb-3" />
      <Panel className="space-y-4 p-5">
        {existingLogins.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              existing logins
            </p>
            {existingLogins.map((l) => (
              <p key={l.email} className="font-mono text-xs text-zinc-300">
                {l.email} {l.full_name ? `· ${l.full_name}` : ""}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            No login for this client yet. Create one so they can sign in and see their
            dashboard + published reports.
          </p>
        )}

        {state.ok ? (
          <div className="rounded-md border border-emerald-700/50 bg-emerald-950/30 p-3">
            <p className="text-sm text-emerald-300">Login created.</p>
            <div className="mt-2 space-y-1 font-mono text-xs">
              <div className="flex gap-2">
                <span className="text-zinc-500">email</span>
                <span className="text-zinc-200">{state.email}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-500">temp password</span>
                <span className="select-all text-orange-300">{state.tempPassword}</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Share these with the client. Ask them to change the password after first
              login. This password won't be shown again.
            </p>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="email"
                type="email"
                required
                placeholder="client@email.com"
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <input
                name="full_name"
                placeholder="Full name (optional)"
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            {state.error ? (
              <p className="text-xs text-red-400">{state.error}</p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create client login"}
            </button>
          </form>
        )}
      </Panel>
    </div>
  );
}
