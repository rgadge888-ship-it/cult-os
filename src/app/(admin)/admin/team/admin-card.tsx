"use client";

import { useActionState, useState, useTransition } from "react";
import {
  setAssignment,
  resetAdminPassword,
  removeAdmin,
  type ResetAdminState,
} from "./actions";
import { Panel } from "@/components/ui/section";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/db/types";

const RESET_INITIAL: ResetAdminState = {};

export function AdminCard({
  admin,
  clients,
  assignedClientIds,
  isSelf,
}: {
  admin: { id: string; email: string; full_name: string | null; role: string };
  clients: { id: string; name: string }[];
  assignedClientIds: string[];
  isSelf: boolean;
}) {
  const isSuper = admin.role === "super_admin";
  // Strategist (like super) sees all clients — no per-client assignment.
  const seesAll = admin.role === "super_admin" || admin.role === "strategist";
  const [assigned, setAssigned] = useState<Set<string>>(new Set(assignedClientIds));
  const [, startTx] = useTransition();
  const reset = resetAdminPassword.bind(null, admin.id);
  const [resetState, resetAction, resetting] = useActionState(reset, RESET_INITIAL);

  const toggle = (clientId: string, next: boolean) => {
    setAssigned((prev) => {
      const s = new Set(prev);
      if (next) s.add(clientId);
      else s.delete(clientId);
      return s;
    });
    startTx(() => setAssignment(admin.id, clientId, next));
  };

  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-100">
            {admin.full_name ?? admin.email.split("@")[0]}
            {isSelf ? <span className="ml-2 text-[10px] text-zinc-500">(you)</span> : null}
          </p>
          <p className="font-mono text-xs text-zinc-500">{admin.email}</p>
        </div>
        <span
          className={`font-mono text-[10px] uppercase tracking-widest ${
            isSuper ? "text-orange-400" : "text-zinc-500"
          }`}
        >
          {ROLE_LABEL[admin.role as AppRole] ?? admin.role}
        </span>
      </div>

      {seesAll ? (
        <p className="text-xs text-zinc-600">
          {isSuper ? "Super admin" : "Strategist"} — sees every client. No assignment needed.
        </p>
      ) : (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            assigned clients · {assigned.size}/{clients.length}
          </p>
          {clients.length === 0 ? (
            <p className="text-xs text-zinc-600">No clients yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {clients.map((c) => {
                const on = assigned.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id, !on)}
                    className={`inline-flex h-7 items-center rounded-md border px-3 text-xs ${
                      on
                        ? "border-orange-500 bg-orange-950/30 text-orange-300"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isSelf ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-900 pt-3">
          {resetState.ok ? (
            <span className="font-mono text-xs">
              <span className="text-zinc-500">new pw </span>
              <span className="select-all text-orange-300">{resetState.tempPassword}</span>
            </span>
          ) : (
            <form action={resetAction}>
              <button
                type="submit"
                disabled={resetting}
                className="inline-flex h-7 items-center rounded border border-zinc-700 px-3 text-[10px] uppercase tracking-widest text-zinc-300 hover:border-orange-500 hover:text-orange-300 disabled:opacity-60"
              >
                {resetting ? "…" : "reset password"}
              </button>
            </form>
          )}
          {!isSuper ? (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove ${admin.email}? This deletes their login.`)) {
                  startTx(() => removeAdmin(admin.id));
                }
              }}
              className="inline-flex h-7 items-center rounded border border-zinc-800 px-3 text-[10px] uppercase tracking-widest text-zinc-500 hover:border-red-700 hover:text-red-400"
            >
              remove
            </button>
          ) : null}
          {resetState.error ? (
            <span className="text-xs text-red-400">{resetState.error}</span>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
