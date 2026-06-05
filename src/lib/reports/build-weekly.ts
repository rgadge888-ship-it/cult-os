import { getSheetMetadata, getSheetValues } from "@/lib/google/sheets";
import { resolveTabTitle, type TabMap } from "@/lib/sheets/tabs";
import { matchColumns, parseNumber } from "./parse";
import type {
  CreativeRow,
  FunnelSnapshot,
  MetricField,
  MetricSet,
  WebinarSnapshot,
  WeeklyReportData,
} from "@/lib/db/types";

// Pick the row that looks like a header: the one with the most non-empty cells
// among the first few rows (handles sheets where row 1 is section labels).
function findHeaderRow(rows: string[][], scan = 4): number {
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < Math.min(scan, rows.length); i++) {
    const count = (rows[i] ?? []).filter((c) => c.trim() !== "").length;
    if (count > bestCount) {
      bestCount = count;
      best = i;
    }
  }
  return best;
}

function rowToMetrics(
  row: string[],
  map: Partial<Record<MetricField, number>>,
): MetricSet {
  const m: MetricSet = {};
  for (const [field, idx] of Object.entries(map) as [MetricField, number][]) {
    const raw = (row[idx] ?? "").toString().trim();
    m[field] = { raw, value: parseNumber(raw) };
  }
  return m;
}

/**
 * Build a weekly report from a client's Mainsheet. Reads the "Weekly Datasheet"
 * tab directly (Option A — Rahul's pre-aggregated weekly rows), using the latest
 * row as the current week and the row above as last week.
 */
export async function buildWeeklyReport(
  userId: string,
  fileId: string,
  tabMap: TabMap = {},
): Promise<WeeklyReportData> {
  const warnings: string[] = [];
  const meta = await getSheetMetadata(userId, fileId);
  const titles = meta.tabs.map((t) => t.title);

  // --- Weekly metrics table (the core) ---
  const weeklyTab = resolveTabTitle("weekly", tabMap, titles);
  if (!weeklyTab) {
    throw new Error("No 'Weekly' tab found in the Mainsheet.");
  }

  const weeklyRows = await getSheetValues(userId, fileId, `'${weeklyTab}'!A1:AZ200`, {
    formatted: true,
  });
  const headerIdx = findHeaderRow(weeklyRows);
  const headers = weeklyRows[headerIdx] ?? [];
  const { map, acqLabel, unmatchedHeaders } = matchColumns(headers);

  if (map.date_range == null) {
    warnings.push("Couldn't find a Date Range column in the Weekly tab.");
  }
  if (unmatchedHeaders.length > 0) {
    warnings.push(`Unmapped weekly columns: ${unmatchedHeaders.join(", ")}`);
  }

  const drIdx = map.date_range ?? 0;
  const dataRows = weeklyRows
    .slice(headerIdx + 1)
    .filter((r) => (r[drIdx] ?? "").toString().trim() !== "");

  if (dataRows.length === 0) {
    throw new Error("No data rows found in the Weekly tab.");
  }

  const currentRow = dataRows[dataRows.length - 1];
  const previousRow = dataRows.length > 1 ? dataRows[dataRows.length - 2] : null;

  const currentMetrics = rowToMetrics(currentRow, map);
  const previousMetrics = previousRow ? rowToMetrics(previousRow, map) : null;
  const currentRange = (currentRow[drIdx] ?? "").toString().trim();
  const previousRange = previousRow ? (previousRow[drIdx] ?? "").toString().trim() : "";

  // --- Funnel snapshot (from the current weekly row) ---
  const funnel: FunnelSnapshot = {
    impressions: currentMetrics.impressions?.value ?? null,
    obc: currentMetrics.obc?.value ?? null,
    lpv: currentMetrics.lpv?.value ?? null,
    registrations: currentMetrics.registrations?.value ?? null,
  };

  // --- Latest webinar (from the Webinar Data tab) ---
  let latestWebinar: WebinarSnapshot | null = null;
  const webinarTab = resolveTabTitle("webinar", tabMap, titles);
  if (webinarTab) {
    try {
      const wRows = await getSheetValues(userId, fileId, `'${webinarTab}'!A1:AZ200`, {
        formatted: true,
      });
      const wHeaderIdx = findHeaderRow(wRows);
      const wHeaders = (wRows[wHeaderIdx] ?? []).map((h) => h.toLowerCase());
      const wData = wRows.slice(wHeaderIdx + 1).filter((r) => (r[0] ?? "").trim() !== "");
      if (wData.length > 0) {
        const last = wData[wData.length - 1];
        const col = (...names: string[]) => {
          const i = wHeaders.findIndex((h) => names.some((n) => h.includes(n)));
          return i >= 0 ? (last[i] ?? "").toString().trim() : null;
        };
        latestWebinar = {
          date: col("webinar date", "date"),
          registrations: parseNumber(col("registration")),
          attendees: parseNumber(col("max attedee", "max attendee", "attendees")),
          attendees_pct: col("attendees%", "attendees %", "attendees("),
          stayed_till_pitch_pct: col("stayed till pitch"),
          converted: parseNumber(col("total converted", "converted")),
          conversion_rate: col("conversion rate"),
          revenue: col("total revenue"),
        };
      }
    } catch (e) {
      warnings.push(`Couldn't read Webinar tab: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  // --- Top creatives (from the Creative Tracking Sheet) ---
  const topCreatives: CreativeRow[] = [];
  const creativeTab = resolveTabTitle("creative", tabMap, titles);
  if (creativeTab) {
    try {
      const cRows = await getSheetValues(userId, fileId, `'${creativeTab}'!A1:BZ200`, {
        formatted: true,
      });
      const cHeaderIdx = findHeaderRow(cRows, 4);
      const cHeaders = (cRows[cHeaderIdx] ?? []).map((h) => h.toLowerCase());
      const idx = (...names: string[]) =>
        cHeaders.findIndex((h) => names.some((n) => h.includes(n)));
      const iName = idx("ad name", "video name", "nomenclature");
      const iSpend = idx("amount spent", "spend");
      const iReg = idx("registrations", "registration");
      const iCpr = idx("cpr", "cpp");
      const iHook = idx("hook rate");
      const iHold = idx("hold rate");
      const iCtr = idx("ctr");
      const iSpendForSort = iSpend;

      const cData = cRows
        .slice(cHeaderIdx + 1)
        .filter((r) => iName >= 0 && (r[iName] ?? "").toString().trim() !== "")
        // Only creatives that actually spent — drops not-yet-run rows that would
        // otherwise show as empty "—" lines.
        .filter((r) => iSpend >= 0 && (parseNumber(r[iSpend]) ?? 0) > 0);

      cData
        .map((r) => ({
          name: iName >= 0 ? (r[iName] ?? "").toString().trim() : "—",
          spend: iSpend >= 0 ? (r[iSpend] ?? "").toString().trim() || null : null,
          registrations: iReg >= 0 ? (r[iReg] ?? "").toString().trim() || null : null,
          cost_per_acq: iCpr >= 0 ? (r[iCpr] ?? "").toString().trim() || null : null,
          hook_rate: iHook >= 0 ? (r[iHook] ?? "").toString().trim() || null : null,
          hold_rate: iHold >= 0 ? (r[iHold] ?? "").toString().trim() || null : null,
          ctr: iCtr >= 0 ? (r[iCtr] ?? "").toString().trim() || null : null,
          _sort: iSpendForSort >= 0 ? parseNumber(r[iSpendForSort]) ?? 0 : 0,
        }))
        .sort((a, b) => b._sort - a._sort)
        .slice(0, 6)
        .forEach(({ _sort, ...rest }) => topCreatives.push(rest));
    } catch (e) {
      warnings.push(`Couldn't read Creative tab: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return {
    source_tab: weeklyTab,
    acq_label: acqLabel,
    current: { range: currentRange, metrics: currentMetrics },
    previous: previousRow ? { range: previousRange, metrics: previousMetrics! } : null,
    funnel,
    latest_webinar: latestWebinar,
    top_creatives: topCreatives,
    warnings,
  };
}
