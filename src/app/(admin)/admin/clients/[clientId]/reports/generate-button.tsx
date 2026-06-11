"use client";

import { useActionState } from "react";
import { generateWeeklyReport, type GenerateState } from "./actions";
import type { ReportStatus } from "@/lib/db/types";
import type { WeeklyReportRangeOption } from "@/lib/reports/build-weekly";

const INITIAL: GenerateState = {};

export function GenerateReportButton({
  clientId,
  options,
  optionsError,
  reportStatusByStart,
}: {
  clientId: string;
  options: WeeklyReportRangeOption[];
  optionsError: string | null;
  reportStatusByStart: Record<string, ReportStatus>;
}) {
  const action = generateWeeklyReport.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const disabled = pending || options.length === 0;

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <select
          name="date_range"
          disabled={disabled}
          className="h-9 min-w-72 rounded-md border border-zinc-800 bg-zinc-950 px-3 font-mono text-xs text-zinc-200 focus:border-orange-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {options.length === 0 ? (
            <option>No weekly ranges found</option>
          ) : (
            options.map((option) => {
              const status = option.week_start_date
                ? reportStatusByStart[option.week_start_date]
                : null;
              return (
                <option key={option.range} value={option.range}>
                  {option.range}
                  {status ? ` · ${status}` : ""}
                </option>
              );
            })
          )}
        </select>
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Reading sheet…" : "Create report"}
        </button>
      </div>
      {optionsError ? (
        <p className="max-w-md text-right text-xs text-red-400">{optionsError}</p>
      ) : null}
      {state.error ? (
        <p className="max-w-md text-right text-xs text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
