"use client";

import { useActionState } from "react";
import { saveTabMap, type SaveTabMapState } from "./tab-map-actions";
import { TAB_ROLES, type TabRole } from "@/lib/sheets/tabs";

const INITIAL: SaveTabMapState = {};

export function TabMapForm({
  clientId,
  availableTitles,
  current,
  guesses,
}: {
  clientId: string;
  availableTitles: string[];
  current: Record<string, string>;
  guesses: Partial<Record<TabRole, string | null>>;
}) {
  const action = saveTabMap.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-4 p-5">
      <p className="text-sm text-zinc-400">
        Map each Cult OS section to the matching tab in this client Mainsheet.
        Tab names differ per client — pick the right one once and every page +
        report will read from it. Blank = let Cult OS auto-detect.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {TAB_ROLES.map(({ role, label, hint }) => {
          const saved = current[role] ?? "";
          // default the select to the saved pin, else the auto-guess.
          const defaultVal =
            saved && availableTitles.includes(saved)
              ? saved
              : guesses[role] ?? "";
          return (
            <div key={role} className="space-y-1.5">
              <label className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-zinc-200">{label}</span>
                <span className="text-[10px] text-zinc-600">{hint}</span>
              </label>
              <select
                name={`tab_${role}`}
                defaultValue={defaultVal}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
              >
                <option value="">— auto-detect —</option>
                {availableTitles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {guesses[role] && !saved ? (
                <p className="font-mono text-[10px] text-zinc-600">
                  auto-guess: {guesses[role]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-900 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save tab mapping"}
        </button>
        {state.ok ? <span className="text-xs text-emerald-400">saved</span> : null}
        {state.error ? <span className="text-xs text-red-400">{state.error}</span> : null}
      </div>
    </form>
  );
}
