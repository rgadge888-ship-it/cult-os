import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import {
  loadDailyDataSheet,
  matchDailyDataColumns,
  summarizeDailyRows,
} from "@/lib/sheets/daily-data";
import type { Client } from "@/lib/db/types";

export default async function AdminClientDailyDataPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const customFrom = sp.from?.trim() ?? "";
  const customTo = sp.to?.trim() ?? "";
  const hasCustom = Boolean(customFrom && customTo);
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, mainsheet_file_id, tab_map")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const c = client as Pick<Client, "id" | "mainsheet_file_id" | "tab_map">;
  let headers: string[] = [];
  let rows: string[][] = [];
  let totalRows = 0;
  let tabTitle: string | null = null;
  let err: string | null = null;

  if (!c.mainsheet_file_id) {
    err = "No Mainsheet is linked for this client.";
  } else {
    try {
      const daily = await loadDailyDataSheet(c.mainsheet_file_id, c.tab_map);
      headers = daily.headers;
      tabTitle = daily.tabTitle;
      totalRows = daily.totalRows;
      const todayIso = new Date().toISOString().slice(0, 10);
      rows = daily.parsedRows
        .filter(({ iso }) => {
          if (iso > todayIso) return false;
          if (hasCustom) return iso >= customFrom && iso <= customTo;
          return true;
        })
        .map((p) => p.row)
        .reverse();
    } catch (e) {
      err = e instanceof Error ? e.message : "Failed to read the Daily Data tab.";
    }
  }

  const columns = matchDailyDataColumns(headers);
  const summary = summarizeDailyRows(
    rows.map((row) => ({ row, iso: "", label: "" })),
    columns,
  );

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          label={tabTitle ?? "daily data"}
          className="mb-3"
          action={
            tabTitle ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                live
              </span>
            ) : null
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <form
            action={`/admin/clients/${clientId}/daily-data`}
            className="flex flex-wrap items-center gap-1"
          >
            <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              range
            </span>
            <input
              type="date"
              name="from"
              defaultValue={customFrom}
              className={`h-8 rounded-md border bg-zinc-950 px-2 text-xs focus:border-orange-500 focus:outline-none ${
                hasCustom ? "border-orange-500 text-orange-300" : "border-zinc-800 text-zinc-300"
              }`}
            />
            <span className="text-zinc-700">→</span>
            <input
              type="date"
              name="to"
              defaultValue={customTo}
              className={`h-8 rounded-md border bg-zinc-950 px-2 text-xs focus:border-orange-500 focus:outline-none ${
                hasCustom ? "border-orange-500 text-orange-300" : "border-zinc-800 text-zinc-300"
              }`}
            />
            <button
              type="submit"
              className="h-8 rounded-md border border-zinc-700 px-3 text-[10px] uppercase tracking-widest text-zinc-300 hover:border-orange-500 hover:text-orange-300"
            >
              apply
            </button>
            {hasCustom ? (
              <Link
                href={`/admin/clients/${clientId}/daily-data`}
                className="h-8 rounded-md border border-zinc-800 px-3 text-[10px] uppercase tracking-widest leading-[1.95rem] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              >
                clear
              </Link>
            ) : null}
          </form>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Ad spend" value={formatInr(summary.totalSpend)} />
          <Stat label="Revenue" value={formatInr(summary.totalRevenue)} accent />
          <Stat label={columns.resultLabel} value={formatCount(summary.totalResults)} />
          <Stat label={columns.costLabel} value={formatInr(summary.costPerResult)} />
        </div>
      ) : null}

      <Panel className="overflow-hidden">
        {err ? (
          <div className="px-6 py-10 text-center text-sm text-red-400">{err}</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            No daily data in this range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                  {headers.map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-3 py-2.5 text-left font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-zinc-900/60 last:border-b-0 hover:bg-zinc-950/60"
                  >
                    {headers.map((_, ci) => (
                      <td
                        key={ci}
                        className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-300"
                      >
                        {(r[ci] ?? "").toString()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {tabTitle ? (
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          showing {rows.length.toLocaleString("en-IN")} of {totalRows.toLocaleString("en-IN")} daily rows
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        accent ? "border-orange-500/40 bg-orange-950/15" : "border-zinc-800 bg-zinc-950/60"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xl ${accent ? "text-orange-300" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

function formatInr(value: number | null): string {
  if (value == null) return "—";
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatCount(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value));
}
