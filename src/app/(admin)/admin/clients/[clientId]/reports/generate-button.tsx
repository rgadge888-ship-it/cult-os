"use client";

import { useActionState } from "react";
import { generateWeeklyReport, type GenerateState } from "./actions";

const INITIAL: GenerateState = {};

export function GenerateReportButton({ clientId }: { clientId: string }) {
  const action = generateWeeklyReport.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Reading sheet…" : "Generate weekly report"}
      </button>
      {state.error ? (
        <p className="max-w-md text-right text-xs text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
