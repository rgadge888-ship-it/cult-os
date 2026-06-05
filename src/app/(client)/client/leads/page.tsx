import Link from "next/link";
import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { resolveTabTitle } from "@/lib/sheets/tabs";
import { Panel, SectionHeader } from "@/components/ui/section";

// Parse a lead timestamp into a UTC date (time-of-day ignored — we filter by
// calendar day). Handles the many shapes Pabbly / Google Forms / TagMango emit:
//   13/05/2026 11:22:47          DD/MM/YYYY  (Indian default)
//   13/05/2026 01:09:54 PM       + 12h clock
//   22/8/2025, 2:35:13 pm        single-digit + comma + am/pm
//   13-05-2026                   dash separators
//   2026-05-13[T ]...            ISO
//   13/05/26                     2-digit year
function parseLeadDate(s: string): Date | null {
  if (!s) return null;
  const trimmed = s.trim();

  // ISO first (unambiguous)
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD-MM-YYYY (day first — Indian convention). Year may be 2 or 4
  // digits. Anything after the date (time, am/pm, comma) is ignored for the day
  // bucket.
  const m = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let year = +m[3];
    if (year < 100) year += year < 70 ? 2000 : 1900; // 26 -> 2026
    const day = +m[1];
    const month = +m[2] - 1;
    // Sanity: reject impossible day/month combos so a stray "2026/05/13" that
    // slipped past the ISO check doesn't become day 2026.
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Last resort: let JS try (handles "May 13, 2026" etc).
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// "days" semantics:
//   null    → no start filter (all time)
//   0       → only today (start = today 00:00, end = today 23:59)
//   -1      → only yesterday (start = yesterday 00:00, end = yesterday 23:59)
//   N > 0   → last N days (rolling)
const RANGES = {
  today: { label: "Today", days: 0 },
  yesterday: { label: "Yesterday", days: -1 },
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  all: { label: "All time", days: null as number | null },
} as const;
type RangeKey = keyof typeof RANGES;

export default async function ClientLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const customFrom = sp.from?.trim() ?? "";
  const customTo = sp.to?.trim() ?? "";
  const hasCustom = Boolean(customFrom && customTo);
  // Default to "all" — lead activity is bursty around webinars, so a 30-day
  // default often shows nothing and looks broken. Show everything, let them narrow.
  const range = (sp.range && sp.range in RANGES ? sp.range : "all") as RangeKey;
  const tagFilter = sp.tag?.trim() ?? "";

  const { client } = await getCurrentClientContext();

  let headers: string[] = [];
  let rows: string[][] = [];
  let allTags: string[] = [];
  let err: string | null = null;
  let totalInSheet = 0;
  const dateStats: {
    newest: Date | null;
    oldest: Date | null;
    unparsed: number;
    hasTimeCol: boolean;
  } = { newest: null, oldest: null, unparsed: 0, hasTimeCol: false };

  if (client?.mainsheet_file_id) {
    try {
      const meta = await getSheetMetadataAsAgency(client.mainsheet_file_id);
      const titles = meta.tabs.map((t) => t.title);
      const tabTitle = resolveTabTitle("leads", client.tab_map, titles);
      const tab = tabTitle ? meta.tabs.find((t) => t.title === tabTitle) : null;
      if (!tab) {
        err = "Couldn't find a Leads tab in your Mainsheet.";
      } else {
        const values = await getSheetValuesAsAgency(
          client.mainsheet_file_id,
          // No row cap — clients accumulate years of leads (10k+ rows). A fixed
          // cap silently hid the newest leads below the cutoff row.
          `'${tab.title}'!A:Z`,
          { formatted: true },
        );
        headers = (values[0] ?? []).filter((c) => c.trim() !== "");
        const dataRows = values
          .slice(1)
          .filter((r) => r.some((c) => (c ?? "").trim() !== ""));
        totalInSheet = dataRows.length;

        const head = headers.map((h) => h.toLowerCase());
        const iTime = head.findIndex(
          (h) => h.includes("timestamp") || h.includes("date") || h.includes("time"),
        );
        const iTag = head.findIndex((h) => h.includes("webinar tag") || h.includes("tag"));

        // Stats over all leads: newest/oldest parsed day + how many timestamps
        // we couldn't read. Drives the diagnostic empty state.
        if (iTime >= 0) {
          let unparsed = 0;
          for (const r of dataRows) {
            const d = parseLeadDate((r[iTime] ?? "").toString());
            if (!d) {
              unparsed++;
              continue;
            }
            if (!dateStats.newest || d > dateStats.newest) dateStats.newest = d;
            if (!dateStats.oldest || d < dateStats.oldest) dateStats.oldest = d;
          }
          dateStats.unparsed = unparsed;
          dateStats.hasTimeCol = true;
        }

        // Build unique tags list
        if (iTag >= 0) {
          const tagSet = new Set<string>();
          for (const r of dataRows) {
            const t = (r[iTag] ?? "").toString().trim();
            if (t) tagSet.add(t);
          }
          allTags = Array.from(tagSet).sort().reverse();
        }

        // Date range filter — custom (from/to) overrides preset
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setUTCHours(23, 59, 59, 999);

        const { startCutoff, endCutoff } = (() => {
          if (hasCustom) {
            return {
              startCutoff: new Date(`${customFrom}T00:00:00Z`),
              endCutoff: new Date(`${customTo}T23:59:59Z`),
            };
          }
          const cfg = RANGES[range];
          if (cfg.days == null) return { startCutoff: null, endCutoff: null };
          if (cfg.days === 0) return { startCutoff: todayStart, endCutoff: todayEnd };
          if (cfg.days === -1) {
            const y0 = new Date(todayStart);
            y0.setUTCDate(y0.getUTCDate() - 1);
            const y1 = new Date(todayEnd);
            y1.setUTCDate(y1.getUTCDate() - 1);
            return { startCutoff: y0, endCutoff: y1 };
          }
          const d = new Date(todayStart);
          d.setUTCDate(d.getUTCDate() - cfg.days);
          return { startCutoff: d, endCutoff: null };
        })();

        rows = dataRows
          .filter((r) => {
            if (startCutoff != null && iTime >= 0) {
              const d = parseLeadDate((r[iTime] ?? "").toString());
              if (!d) return false;
              if (d < startCutoff) return false;
              if (endCutoff && d > endCutoff) return false;
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
    if (r !== "all") params.set("range", r);
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
                range === key && !hasCustom
                  ? "border-orange-500 bg-orange-950/30 text-orange-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              }`}
            >
              {cfg.label}
            </Link>
          ),
        )}
        {/* Custom date range */}
        <form action="/client/leads" className="flex items-center gap-1">
          {tagFilter ? <input type="hidden" name="tag" value={tagFilter} /> : null}
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
        </form>
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
                {range !== "all" ? <input type="hidden" name="range" value={range} /> : null}
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
            <div className="space-y-2 px-6 py-10 text-center text-sm text-zinc-500">
              <p>
                No leads in this range
                {tagFilter ? ` for tag ${tagFilter}` : ""}.
              </p>
              {dateStats.newest ? (
                <p className="font-mono text-[11px] text-zinc-600">
                  newest lead {fmtDay(dateStats.newest)}
                  {dateStats.oldest ? ` · oldest ${fmtDay(dateStats.oldest)}` : ""} ·
                  try a wider range
                </p>
              ) : dateStats.hasTimeCol && dateStats.unparsed > 0 ? (
                <p className="font-mono text-[11px] text-amber-500/80">
                  couldn&apos;t read {dateStats.unparsed.toLocaleString("en-IN")} lead
                  dates — showing all is recommended
                </p>
              ) : null}
              {range !== "all" || tagFilter ? (
                <Link
                  href="/client/leads"
                  className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-[10px] uppercase tracking-widest text-zinc-300 hover:border-orange-500 hover:text-orange-300"
                >
                  show all leads
                </Link>
              ) : null}
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
