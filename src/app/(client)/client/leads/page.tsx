import Link from "next/link";
import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { Panel, SectionHeader } from "@/components/ui/section";

// Try to parse the Leadsheet's Timestamp column. Pabbly typically writes
// "13/05/2026 11:22:47" (DD/MM/YYYY). Also accept ISO and "MMM D, YYYY".
function parseLeadDate(s: string): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  // DD/MM/YYYY HH:MM:SS or DD/MM/YYYY
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return new Date(
      Date.UTC(
        Number(m[3]),
        Number(m[2]) - 1,
        Number(m[1]),
        Number(m[4] ?? 0),
        Number(m[5] ?? 0),
        Number(m[6] ?? 0),
      ),
    );
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

const RANGES = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  all: { label: "All time", days: null as number | null },
} as const;
type RangeKey = keyof typeof RANGES;

export default async function ClientLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const range = (sp.range && sp.range in RANGES ? sp.range : "30d") as RangeKey;
  const tagFilter = sp.tag?.trim() ?? "";

  const { client } = await getCurrentClientContext();

  let headers: string[] = [];
  let rows: string[][] = [];
  let allTags: string[] = [];
  let err: string | null = null;
  let totalInSheet = 0;

  if (client?.mainsheet_file_id) {
    try {
      const meta = await getSheetMetadataAsAgency(client.mainsheet_file_id);
      const tab = meta.tabs.find((t) => /lead/i.test(t.title));
      if (!tab) {
        err = "Couldn't find a Leads tab in your Mainsheet.";
      } else {
        const values = await getSheetValuesAsAgency(
          client.mainsheet_file_id,
          `'${tab.title}'!A1:Z5000`,
          { formatted: true },
        );
        headers = (values[0] ?? []).filter((c) => c.trim() !== "");
        const dataRows = values
          .slice(1)
          .filter((r) => r.some((c) => (c ?? "").trim() !== ""));
        totalInSheet = dataRows.length;

        const head = headers.map((h) => h.toLowerCase());
        const iTime = head.findIndex((h) => h.includes("timestamp") || h === "date");
        const iTag = head.findIndex((h) => h.includes("webinar tag") || h.includes("tag"));

        // Build unique tags list
        if (iTag >= 0) {
          const tagSet = new Set<string>();
          for (const r of dataRows) {
            const t = (r[iTag] ?? "").toString().trim();
            if (t) tagSet.add(t);
          }
          allTags = Array.from(tagSet).sort().reverse();
        }

        // Date range filter
        const cutoff = (() => {
          const cfg = RANGES[range];
          if (cfg.days == null) return null;
          const d = new Date();
          d.setUTCDate(d.getUTCDate() - cfg.days);
          d.setUTCHours(0, 0, 0, 0);
          return d;
        })();

        rows = dataRows
          .filter((r) => {
            if (cutoff != null && iTime >= 0) {
              const d = parseLeadDate((r[iTime] ?? "").toString());
              if (!d || d < cutoff) return false;
            }
            if (tagFilter && iTag >= 0) {
              const t = (r[iTag] ?? "").toString().trim();
              if (t !== tagFilter) return false;
            }
            return true;
          })
          .reverse();
      }
    } catch (e) {
      err = e instanceof Error ? e.message : "Failed to read the Mainsheet.";
    }
  }

  const buildHref = (next: Partial<{ range: RangeKey; tag: string }>) => {
    const params = new URLSearchParams();
    const r = next.range ?? range;
    if (r !== "30d") params.set("range", r);
    const t = next.tag ?? tagFilter;
    if (t) params.set("tag", t);
    const q = params.toString();
    return `/client/leads${q ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► leads
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Your leads
        </h1>
        <p className="text-sm text-zinc-500">
          live from your lead capture · {rows.length.toLocaleString("en-IN")} shown of{" "}
          {totalInSheet.toLocaleString("en-IN")}
        </p>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(Object.entries(RANGES) as [RangeKey, (typeof RANGES)[RangeKey]][]).map(
          ([key, cfg]) => (
            <Link
              key={key}
              href={buildHref({ range: key })}
              className={`inline-flex h-8 items-center rounded-md border px-3 text-xs uppercase tracking-widest ${
                range === key
                  ? "border-orange-500 bg-orange-950/30 text-orange-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {cfg.label}
            </Link>
          ),
        )}
        {allTags.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              webinar tag
            </span>
            {tagFilter ? (
              <Link
                href={buildHref({ tag: "" })}
                className="inline-flex h-8 items-center rounded-md border border-orange-500 bg-orange-950/30 px-3 text-xs text-orange-300"
              >
                {tagFilter} ×
              </Link>
            ) : (
              <form action="/client/leads" className="flex items-center gap-2">
                {range !== "30d" ? <input type="hidden" name="range" value={range} /> : null}
                <select
                  name="tag"
                  defaultValue=""
                  className="h-8 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">all tags</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="h-8 rounded-md border border-zinc-700 px-3 text-[10px] uppercase tracking-widest text-zinc-300 hover:border-orange-500 hover:text-orange-300"
                >
                  apply
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <SectionHeader
          label="leads"
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
              No leads in this range
              {tagFilter ? ` for tag ${tagFilter}` : ""}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                    {headers.slice(0, 9).map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r, ri) => (
                    <tr
                      key={ri}
                      className="border-b border-zinc-900/60 last:border-b-0 hover:bg-zinc-950/60"
                    >
                      {headers.slice(0, 9).map((_, ci) => (
                        <td
                          key={ci}
                          className="max-w-xs truncate px-4 py-2 font-mono text-xs text-zinc-300"
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
        {rows.length > 500 ? (
          <p className="mt-2 text-xs text-zinc-600">
            Showing first 500 of {rows.length.toLocaleString("en-IN")}. Narrow the range
            or tag to see specific leads.
          </p>
        ) : null}
      </div>
    </div>
  );
}
