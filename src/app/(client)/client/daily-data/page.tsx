import Link from "next/link";
import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { resolveTabTitle } from "@/lib/sheets/tabs";
import { Panel, SectionHeader } from "@/components/ui/section";
import { parseNumber, parseDateRange } from "@/lib/reports/parse";

function findHeaderIdx(rows: string[][], scan = 4): number {
  let best = 0;
  let bestN = -1;
  for (let i = 0; i < Math.min(scan, rows.length); i++) {
    const n = (rows[i] ?? []).filter((c) => c.trim() !== "").length;
    if (n > bestN) {
      bestN = n;
      best = i;
    }
  }
  return best;
}

export default async function ClientDailyDataPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const customFrom = sp.from?.trim() ?? "";
  const customTo = sp.to?.trim() ?? "";
  const hasCustom = Boolean(customFrom && customTo);

  const { client } = await getCurrentClientContext();

  let headers: string[] = [];
  let rows: string[][] = [];
  let totalDays = 0;
  let err: string | null = null;
  let tabTitle: string | null = null;

  if (client?.mainsheet_file_id) {
    try {
      const meta = await getSheetMetadataAsAgency(client.mainsheet_file_id);
      const titles = meta.tabs.map((t) => t.title);
      const resolved = resolveTabTitle("daily", client.tab_map, titles);
      const tab = resolved ? meta.tabs.find((t) => t.title === resolved) : null;
      if (!tab) {
        err = "Couldn't find a Daily Data tab in your Mainsheet.";
      } else {
        tabTitle = tab.title;
        const values = await getSheetValuesAsAgency(
          client.mainsheet_file_id,
          `'${tab.title}'!A1:Z200`,
          { formatted: true },
        );
        const hIdx = findHeaderIdx(values);
        headers = (values[hIdx] ?? []).map((h) => h.trim());
        const todayIso = new Date().toISOString().slice(0, 10);
        const parsedRows = values
          .slice(hIdx + 1)
          .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
          .map((r) => {
            const dr = parseDateRange(((r[0] ?? "").toString().trim()));
            return dr ? { row: r, iso: dr.start } : null;
          })
          .filter(Boolean) as { row: string[]; iso: string }[];

        totalDays = parsedRows.length;

        const filtered = parsedRows.filter(({ iso }) => {
          if (iso > todayIso) return false; // no future
          if (hasCustom) return iso >= customFrom && iso <= customTo;
          return true;
        });
        rows = filtered.map((p) => p.row).reverse(); // newest first
      }
    } catch (e) {
      err = e instanceof Error ? e.message : "Failed to read the Mainsheet.";
    }
  }

  const head = headers.map((h) => h.toLowerCase());
  const iSpend = head.findIndex((h) => h === "with gst" || h === "ad spend" || h === "spend");
  const iReg = head.findIndex((h) => h.includes("registration") && !h.includes("fb"));
  const iRev = head.findIndex((h) => h.includes("total revenue"));
  const totalSpend = iSpend >= 0 ? rows.reduce((s, r) => s + (parseNumber(r[iSpend]) ?? 0), 0) : 0;
  const totalReg = iReg >= 0 ? rows.reduce((s, r) => s + (parseNumber(r[iReg]) ?? 0), 0) : 0;
  const totalRev = iRev >= 0 ? rows.reduce((s, r) => s + (parseNumber(r[iRev]) ?? 0), 0) : 0;

  const inr = (n: number) =>
    "₹" +
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► daily data
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Daily Ad Spend
        </h1>
        <p className="text-sm text-zinc-500">
          straight from your Mainsheet ·{" "}
          {rows.length.toLocaleString("en-IN")} of {totalDays.toLocaleString("en-IN")} days
        </p>
      </div>

      {/* Date filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form action="/client/daily-data" className="flex items-center gap-1">
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
              href="/client/daily-data"
              className="ml-1 h-8 rounded-md border border-zinc-800 px-3 text-[10px] uppercase tracking-widest leading-[1.95rem] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            >
              clear
            </Link>
          ) : null}
        </form>
      </div>

      {/* Totals strip */}
      {rows.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Spend (window)" value={inr(totalSpend)} />
          <Stat label="Registrations" value={totalReg.toLocaleString("en-IN")} />
          <Stat label="Revenue" value={inr(totalRev)} accent />
        </div>
      ) : null}

      <div className="mt-8">
        <SectionHeader
          label={tabTitle ?? "daily"}
          className="mb-3"
          action={
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
              live
            </span>
          }
        />
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
                      <th
                        key={i}
                        className="whitespace-nowrap px-3 py-2.5 text-left font-normal"
                      >
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
      </div>
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
