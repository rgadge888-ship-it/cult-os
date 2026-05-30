import type { ReactNode } from "react";
import { Panel } from "@/components/ui/section";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-900/70 ${className}`}
      aria-hidden
    />
  );
}

// Generic page skeleton: matches the typical layout (header + a few panels).
export function PageSkeleton({
  title,
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-2">
        <Skeleton className="h-2 w-20" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-40" />
      </div>
      {title ? (
        <span className="sr-only">{title}</span>
      ) : null}
      <div className="mt-8 space-y-6">
        {children ?? (
          <>
            <SkeletonPanel rows={3} />
            <SkeletonPanel rows={5} />
          </>
        )}
      </div>
    </div>
  );
}

// A panel with a header bar + rows of fake data.
export function SkeletonPanel({ rows = 4 }: { rows?: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-2 w-24" />
        <div className="h-px flex-1 bg-zinc-900" />
      </div>
      <Panel className="divide-y divide-zinc-900/60">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </Panel>
    </div>
  );
}

// Grid of metric-card skeletons for KPI blocks.
export function SkeletonKpis({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-${cols}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4"
        >
          <Skeleton className="h-2 w-12" />
          <Skeleton className="mt-3 h-8 w-32" />
        </div>
      ))}
    </div>
  );
}
