import type { ClientStatus, DeliverableStatus, ReportStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type Status = ClientStatus | DeliverableStatus | ReportStatus | "live" | "paused" | "ended";

const TONES: Record<string, string> = {
  // greens — healthy / active
  active:        "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  done:          "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  published:     "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
  live:          "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",

  // ambers — in flight
  in_progress:   "border-amber-700/50 bg-amber-950/40 text-amber-300",
  onboarding:    "border-amber-700/50 bg-amber-950/40 text-amber-300",
  draft:         "border-amber-700/50 bg-amber-950/40 text-amber-300",

  // greys — dormant
  not_started:   "border-zinc-800 bg-zinc-950 text-zinc-500",
  paused:        "border-zinc-800 bg-zinc-950 text-zinc-400",
  ended:         "border-zinc-800 bg-zinc-950 text-zinc-500",
  churned:       "border-zinc-800 bg-zinc-950 text-zinc-500",

  // reds — blocked
  blocked:       "border-red-800/50 bg-red-950/40 text-red-300",
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const tone = TONES[status] ?? "border-zinc-800 bg-zinc-950 text-zinc-400";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        tone,
        className,
      )}
    >
      <span className="inline-block h-1 w-1 rounded-full bg-current" />
      {status.replace(/_/g, " ")}
    </span>
  );
}
