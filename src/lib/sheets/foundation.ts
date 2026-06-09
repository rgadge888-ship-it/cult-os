import { getSheetMetadataAsAgency, getSheetValuesAsAgency } from "@/lib/google/sheets";
import { parseNumber } from "@/lib/reports/parse";
import { resolveTabTitle, type TabMap } from "@/lib/sheets/tabs";

export type ResultCostMetric = "CPP" | "CPR" | "CPL";
export type FoundationKpiKind = "costPerResult" | "ctr" | "cpm" | "custom";

export type FoundationKpi = {
  label: string;
  kind: FoundationKpiKind;
  target: number | null;
  raw: string;
};

export type FoundationSheet = {
  tabTitle: string;
  resultMetric: ResultCostMetric | null;
  targets: FoundationKpi[];
  kpis: {
    costPerResult: FoundationKpi | null;
    ctr: FoundationKpi | null;
    cpm: FoundationKpi | null;
  };
};

function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\\/g, "")
    .replace(/[()%₹$,:/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseResultMetric(raw: string): ResultCostMetric | null {
  const value = norm(raw);
  if (/\bcpp\b/.test(value) || value.includes("purchase")) return "CPP";
  if (/\bcpr\b/.test(value) || value.includes("registration")) return "CPR";
  if (/\bcpl\b/.test(value) || value.includes("lead")) return "CPL";
  return null;
}

function isMetricHeader(header: string): boolean {
  return header === "kpi";
}

function isTargetHeader(header: string): boolean {
  return header === "goal";
}

function classifyKpi(label: string): Exclude<FoundationKpiKind, "custom"> | null {
  const h = norm(label);
  if (h.includes("ctr") || h.includes("click through rate")) return "ctr";
  if (h.includes("cpm") || h.includes("cost per mille") || h.includes("cost per thousand")) {
    return "cpm";
  }
  if (
    h.includes("cost per result") ||
    h.includes("cost per purchase") ||
    h.includes("cost per registration") ||
    h.includes("cost per lead") ||
    /\bcpp\b/.test(h) ||
    /\bcpr\b/.test(h) ||
    /\bcpl\b/.test(h)
  ) {
    return "costPerResult";
  }
  return null;
}

function upsertTarget(sheet: FoundationSheet, kpi: FoundationKpi) {
  const key = norm(kpi.label);
  const existingIdx = sheet.targets.findIndex((target) => norm(target.label) === key);
  if (existingIdx >= 0) {
    sheet.targets[existingIdx] = kpi;
  } else {
    sheet.targets.push(kpi);
  }

  if (kpi.kind !== "custom") {
    sheet.kpis[kpi.kind] = kpi;
  }
}

function ingestEntry(
  sheet: FoundationSheet,
  label: string,
  rawValue: string,
) {
  const cleanLabel = label.trim();
  const cleanValue = rawValue.trim();
  if (!cleanLabel || !cleanValue) return;

  const metricFromLabel = parseResultMetric(cleanLabel);
  const metricFromValue = parseResultMetric(cleanValue);

  const kpiKey = classifyKpi(cleanLabel);
  const targetValue = parseNumber(cleanValue);
  if (targetValue != null) {
    const kpi: FoundationKpi = {
      label: cleanLabel,
      kind: kpiKey ?? "custom",
      target: targetValue,
      raw: cleanValue,
    };
    upsertTarget(sheet, kpi);
    if (kpiKey === "costPerResult") {
      sheet.resultMetric = metricFromLabel ?? metricFromValue ?? sheet.resultMetric;
    }
    return;
  }

  if (metricFromLabel || metricFromValue) {
    sheet.resultMetric = metricFromLabel ?? metricFromValue;
    return;
  }
}

export async function loadFoundationSheet(
  fileId: string,
  tabMap: TabMap | null | undefined,
): Promise<FoundationSheet | null> {
  const meta = await getSheetMetadataAsAgency(fileId);
  const titles = meta.tabs.map((t) => t.title);
  const resolved = resolveTabTitle("foundation", tabMap, titles);
  const tab = resolved ? meta.tabs.find((t) => t.title === resolved) : null;
  if (!tab) return null;

  const rows = await getSheetValuesAsAgency(fileId, `${quoteTab(tab.title)}!A:Z`, {
    formatted: true,
  });

  const sheet: FoundationSheet = {
    tabTitle: tab.title,
    resultMetric: null,
    targets: [],
    kpis: {
      costPerResult: null,
      ctr: null,
      cpm: null,
    },
  };

  const headerRowIdx = rows.findIndex((row) => {
    const headers = row.map((cell) => norm(cell ?? ""));
    return headers.some(isMetricHeader) && headers.some(isTargetHeader);
  });
  if (headerRowIdx < 0) return sheet;

  const headers = rows[headerRowIdx].map((cell) => norm(cell ?? ""));
  const metricIdx = headers.findIndex(isMetricHeader);
  const targetIdx = headers.findIndex(isTargetHeader);

  for (const row of rows.slice(headerRowIdx + 1)) {
    ingestEntry(sheet, row[metricIdx] ?? "", row[targetIdx] ?? "");
  }

  return sheet;
}
