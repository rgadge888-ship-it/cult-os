import { getSheetMetadataAsAgency, getSheetValuesAsAgency } from "@/lib/google/sheets";
import { parseDateRange, parseNumber } from "@/lib/reports/parse";
import { resolveTabTitle, type TabMap } from "@/lib/sheets/tabs";

export type DailyDataRow = {
  row: string[];
  iso: string;
  label: string;
};

export type DailyDataSheet = {
  tabTitle: string;
  headers: string[];
  rows: string[][];
  parsedRows: DailyDataRow[];
  totalRows: number;
};

export type DailyDataColumns = {
  date: number;
  spend: number;
  revenue: number;
  results: number;
  costPerResult: number;
  ctr: number;
  costLabel: string;
  resultLabel: string;
};

export function findHeaderIdx(rows: string[][], scan = 4): number {
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

function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function columnName(index: number): string {
  let n = Math.max(1, index);
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\\/g, "")
    .replace(/[()%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCol(headers: string[], predicates: ((h: string) => boolean)[]): number {
  const normalized = headers.map(norm);
  return normalized.findIndex((h) => predicates.some((predicate) => predicate(h)));
}

export async function loadDailyDataSheet(
  fileId: string,
  tabMap: TabMap | null | undefined,
): Promise<DailyDataSheet> {
  const meta = await getSheetMetadataAsAgency(fileId);
  const titles = meta.tabs.map((t) => t.title);
  const resolved = resolveTabTitle("daily", tabMap, titles);
  const tab = resolved ? meta.tabs.find((t) => t.title === resolved) : null;
  if (!tab) throw new Error("No Daily Data tab found in this Mainsheet.");

  const lastColumn = columnName(tab.columnCount || 26);
  const values = await getSheetValuesAsAgency(fileId, `${quoteTab(tab.title)}!A:${lastColumn}`, {
    formatted: true,
  });
  const hIdx = findHeaderIdx(values);
  const headers = (values[hIdx] ?? []).map((h) => h.trim());
  const parsedRows = values
    .slice(hIdx + 1)
    .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
    .map((row) => {
      const label = (row[0] ?? "").toString().trim();
      const parsed = parseDateRange(label);
      return parsed ? { row, iso: parsed.start, label } : null;
    })
    .filter(Boolean) as DailyDataRow[];

  return {
    tabTitle: tab.title,
    headers,
    rows: parsedRows.map((r) => r.row),
    parsedRows,
    totalRows: parsedRows.length,
  };
}

export function matchDailyDataColumns(headers: string[]): DailyDataColumns {
  const date = findCol(headers, [(h) => h === "date" || h.startsWith("date")]);
  const spend = findCol(headers, [
    (h) => h === "with gst",
    (h) => h === "ad spend",
    (h) => h === "spend",
    (h) => h === "amount spent",
    (h) => h.includes("spend with gst"),
  ]);
  const revenue = findCol(headers, [
    (h) => h === "total revenue",
    (h) => h === "revenue",
    (h) => h.includes("revenue"),
  ]);
  const results = findCol(headers, [
    (h) => h === "registrations",
    (h) => h === "registration",
    (h) => h === "leads",
    (h) => h === "lead",
    (h) => h.includes("purchase"),
    (h) => h.includes("result"),
  ]);
  const costPerResult = findCol(headers, [
    (h) => h === "cpr",
    (h) => h === "cpp",
    (h) => h === "cpl",
    (h) => h.includes("cost per registration"),
    (h) => h.includes("cost per purchase"),
    (h) => h.includes("cost per lead"),
    (h) => h.includes("cost per result"),
  ]);
  const ctr = findCol(headers, [(h) => h === "ctr", (h) => h === "ctr percentage"]);
  const costHeader = costPerResult >= 0 ? norm(headers[costPerResult] ?? "") : "";
  const resultHeader = results >= 0 ? headers[results] : "Results";

  return {
    date,
    spend,
    revenue,
    results,
    costPerResult,
    ctr,
    costLabel: costHeader.includes("cpp")
      ? "CPP"
      : costHeader.includes("cpl")
        ? "CPL"
        : "CPR",
    resultLabel: resultHeader || "Results",
  };
}

export function summarizeDailyRows(rows: DailyDataRow[], columns: DailyDataColumns) {
  const totalSpend =
    columns.spend >= 0
      ? rows.reduce((sum, r) => sum + (parseNumber(r.row[columns.spend]) ?? 0), 0)
      : null;
  const totalRevenue =
    columns.revenue >= 0
      ? rows.reduce((sum, r) => sum + (parseNumber(r.row[columns.revenue]) ?? 0), 0)
      : null;
  const totalResults =
    columns.results >= 0
      ? rows.reduce((sum, r) => sum + (parseNumber(r.row[columns.results]) ?? 0), 0)
      : null;
  const costPerResult =
    totalSpend != null && totalResults != null && totalResults > 0
      ? totalSpend / totalResults
      : null;
  const ctrValues =
    columns.ctr >= 0
      ? rows
          .map((r) => parseNumber(r.row[columns.ctr]))
          .filter((v): v is number => v != null)
      : [];
  const avgCtr =
    ctrValues.length > 0
      ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length
      : null;

  return { totalSpend, totalRevenue, totalResults, costPerResult, avgCtr };
}
