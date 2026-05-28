import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Terminal-style section header: [ LABEL ] ───────────── action
export function SectionHeader({
  label,
  action,
  className,
}: {
  label: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
        [ {label} ]
      </span>
      <span className="h-px flex-1 bg-zinc-800" />
      {action}
    </div>
  );
}

// Card with HUD border style.
export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-zinc-800 bg-zinc-950/60 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
