import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import type { WeeklyReport } from "@/lib/db/types";

export default async function ClientReportsPage() {
  await requireUser({ clientOnly: true });
  const supabase = await createClient();

  // RLS limits this to the client's own published reports.
  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("id, week_start_date, week_end_date, status, published_at")
    .eq("status", "published")
    .order("week_start_date", { ascending: false });

  const rows = (reports ?? []) as Pick<
    WeeklyReport,
    "id" | "week_start_date" | "week_end_date" | "status" | "published_at"
  >[];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► reports
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Weekly reports
        </h1>
        <p className="text-sm text-zinc-500">your performance, week by week</p>
      </div>

      <div className="mt-8">
        <SectionHeader label="published" className="mb-3" />
        <Panel>
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              No reports published yet. Your team will publish them after each weekly call.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-900">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3">
                  <Link
                    href={`/client/reports/${r.id}`}
                    className="font-mono text-sm text-zinc-200 hover:text-orange-400"
                  >
                    {r.week_start_date} → {r.week_end_date}
                  </Link>
                  <span className="font-mono text-[10px] text-zinc-600">
                    {r.published_at ? new Date(r.published_at).toLocaleDateString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
