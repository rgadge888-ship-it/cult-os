import type { MetricField } from "@/lib/db/types";

// Parse a formatted sheet cell ("₹5,625.66", "3.18%", "131", "-₹653.10") into a
// number. Percentages return the displayed value (3.18% -> 3.18). Returns null
// for blanks / dashes / non-numeric.
export function parseNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (s === "" || s === "—" || s === "-" || s === "–" || s.toLowerCase() === "n/a") {
    return null;
  }
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Drop backslash artifacts, currency, commas, %, spaces, stray symbols.
  s = s.replace(/\\/g, "").replace(/[₹$,%\s]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[^0-9.]/g, "");
  if (s === "" || s === ".") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .replace(/[(),]/g, "")
    .trim();
}

// Exact-normalized synonyms for each canonical field. Order within arrays
// doesn't matter; matching is exact-after-normalize to avoid false positives
// (e.g. "cpr" must not grab the "cpr - fb" column).
const FIELD_SYNONYMS: Record<MetricField, string[]> = {
  date_range: ["date range", "date", "week", "range"],
  spend: ["ad spend", "spend", "amount spent"],
  spend_with_gst: ["with gst", "ad spend with gst", "spend with gst", "ad spent with gst"],
  registrations: ["registrations", "regs", "registration", "webinar registrations"],
  registrations_fb: ["reg - fb", "reg fb", "registrations fb"],
  cost_per_acq: ["cpr", "cpp", "cost per registration", "cost per purchase"],
  cost_per_acq_fb: ["cpr - fb", "cpp - fb", "cpr fb", "cpp fb"],
  impressions: ["imp", "impressions", "impression"],
  cpm: ["cpm"],
  obc: ["obc", "outbound clicks"],
  ctr: ["ctr %", "ctr", "ctr percentage"],
  cpc: ["cpc"],
  lpv: ["lpv", "landing page views"],
  obc_to_lpv: ["obc > lpv %", "obc > lpv", "obc to lpv %", "obc to lpv"],
  lpv_to_reg: ["lpv > reg %", "lpv > reg", "lpv > pur %", "lpv > pur", "lpv to reg"],
  call_booking: ["call booking", "call bookings", "call bookin"],
  upsells: ["upsells l1", "upsells", "l1 upsell", "upsell", "upsells(l1)"],
  revenue: ["total revenue", "revenue"],
  net_profit: ["gross profit", "net profit", "net profit/loss", "net p/l", "profit"],
  roas: ["roas"],
};

export type ColumnMatch = {
  map: Partial<Record<MetricField, number>>; // field -> column index
  acqLabel: "CPR" | "CPP";
  unmatchedHeaders: string[];
};

// Match a header row to canonical fields. Exact-normalized first; each column
// claims at most one field, each field claims at most one column.
export function matchColumns(headers: string[]): ColumnMatch {
  const map: Partial<Record<MetricField, number>> = {};
  let acqLabel: "CPR" | "CPP" = "CPR";
  const claimed = new Set<number>();
  const norms = headers.map(normalize);

  norms.forEach((n) => {
    if (n === "cpp") acqLabel = "CPP";
    if (n === "cpr") acqLabel = "CPR";
  });

  for (const [field, syns] of Object.entries(FIELD_SYNONYMS) as [MetricField, string[]][]) {
    // Normalize synonyms the same way as headers so e.g. "Upsells(L1)" -> "upsellsl1"
    // matches the synonym "upsells(l1)" -> "upsellsl1".
    const normSyns = syns.map(normalize);
    const idx = norms.findIndex((n, i) => !claimed.has(i) && normSyns.includes(n));
    if (idx >= 0) {
      map[field] = idx;
      claimed.add(idx);
    }
  }

  const unmatchedHeaders = headers.filter((_, i) => !claimed.has(i) && headers[i].trim() !== "");
  return { map, acqLabel, unmatchedHeaders };
}

// For delta coloring: which direction is "good" for each metric.
export const HIGHER_IS_BETTER: Partial<Record<MetricField, boolean>> = {
  registrations: true,
  registrations_fb: true,
  impressions: true,
  obc: true,
  lpv: true,
  ctr: true,
  obc_to_lpv: true,
  lpv_to_reg: true,
  call_booking: true,
  upsells: true,
  revenue: true,
  net_profit: true,
  roas: true,
  cost_per_acq: false,
  cost_per_acq_fb: false,
  cpc: false,
  cpm: false,
  // spend is neutral (more spend isn't inherently good or bad)
};

// Human labels for each field in report tables.
export const FIELD_LABELS: Record<MetricField, string> = {
  date_range: "Date Range",
  spend: "Ad Spend",
  spend_with_gst: "Ad Spend (with GST)",
  registrations: "Registrations",
  registrations_fb: "Registrations (FB)",
  cost_per_acq: "CPR",
  cost_per_acq_fb: "CPR (FB)",
  impressions: "Impressions",
  cpm: "CPM",
  obc: "OBC",
  ctr: "CTR",
  cpc: "CPC",
  lpv: "LPV",
  obc_to_lpv: "OBC › LPV %",
  lpv_to_reg: "LPV › REG %",
  call_booking: "Call Bookings",
  upsells: "Upsells (L1)",
  revenue: "Total Revenue",
  net_profit: "Net Profit / Loss",
  roas: "ROAS",
};

// Parse a "May 13 - May 18" style range into ISO start/end dates.
// Also handles single dates in several common formats:
//   "May 13", "May-13"    — month-name + day (current year assumed)
//   "13 May 2026"          — day + month + year
//   "13/05/2026"           — DD/MM/YYYY (Indian/UK convention)
//   "2026-05-13"           — ISO
export function parseDateRange(
  range: string,
  year = new Date().getUTCFullYear(),
): { start: string; end: string } | null {
  const MONTHS: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
    may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8,
    sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };

  const isoFor = (d: Date) => d.toISOString().slice(0, 10);
  const single = (d: Date) => ({ start: isoFor(d), end: isoFor(d) });

  const trimmed = range.trim();
  if (!trimmed) return null;

  // ISO YYYY-MM-DD
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    if (!Number.isNaN(d.getTime())) return single(d);
  }

  // DD/MM/YYYY (Indian sheets default)
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const d = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
    if (!Number.isNaN(d.getTime())) return single(d);
  }

  // Split only when the separator is surrounded by whitespace (or "to" word).
  // This keeps "May-13" as a single date while "May 13 - May 18" splits into a
  // range. Daily Datasheet uses "May-13" format; weekly reports use the spaced
  // hyphen form.
  const parts = trimmed
    .split(/\s+(?:-|–|—|to)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const parseOne = (s: string, fallbackMonth: number | null) => {
    const moMatch = s.match(/[A-Za-z]+/);
    const dyMatch = s.match(/\d{1,2}/);
    if (!dyMatch) return null;
    const month = moMatch ? MONTHS[moMatch[0].toLowerCase()] : fallbackMonth;
    if (month == null) return null;
    return { month, day: Number(dyMatch[0]) };
  };

  const a = parseOne(parts[0], null);
  const b = parts[1] ? parseOne(parts[1], a?.month ?? null) : a;
  if (!a || !b) return null;

  let start = new Date(Date.UTC(year, a.month, a.day));
  let end = new Date(Date.UTC(year, b.month, b.day));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  // Year-less dates default to the current year, but if that lands a long way
  // in the future (>60 days) the row is almost certainly historical — shift it
  // back a year. e.g. "Nov 15" parsed in May 2026 means Nov 2025, not Nov 2026.
  const todayMs = Date.now();
  const SIX_WEEKS = 60 * 24 * 3600 * 1000;
  if (start.getTime() > todayMs + SIX_WEEKS) {
    start = new Date(Date.UTC(year - 1, a.month, a.day));
    end = new Date(Date.UTC(year - 1, b.month, b.day));
  }

  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
