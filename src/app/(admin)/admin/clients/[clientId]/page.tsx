import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import {
  loadDailyDataSheet,
  matchDailyDataColumns,
  summarizeDailyRows,
  type DailyDataColumns,
  type DailyDataRow,
} from "@/lib/sheets/daily-data";
import { loadFoundationSheet, type FoundationKpi, type FoundationSheet } from "@/lib/sheets/foundation";
import { parseNumber } from "@/lib/reports/parse";
import type { Client, WeeklyReport } from "@/lib/db/types";

type TrendPoint = {
  label: string;
  value: number;
};

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [
    { data: client },
    { data: latestReport },
    { count: openTasks },
    { count: allTasks },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),
    supabase
      .from("weekly_reports")
      .select("id, week_start_date, week_end_date, status, generated_at")
      .eq("client_id", clientId)
      .order("week_start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("status", "done"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);

  if (!client) notFound();

  const c = client as Client;
  const report = latestReport as
    | Pick<WeeklyReport, "id" | "week_start_date" | "week_end_date" | "status" | "generated_at">
    | null;

  let monthRows: DailyDataRow[] = [];
  let columns: DailyDataColumns | null = null;
  let sheetError: string | null = null;
  let cpaTrend: TrendPoint[] = [];
  let ctrTrend: TrendPoint[] = [];
  let dailyTabTitle: string | null = null;
  let dailyHeaders: string[] = [];
  let foundation: FoundationSheet | null = null;

  if (c.mainsheet_file_id) {
    try {
      foundation = await loadFoundationSheet(c.mainsheet_file_id, c.tab_map);
      const daily = await loadDailyDataSheet(c.mainsheet_file_id, c.tab_map);
      dailyTabTitle = daily.tabTitle;
      dailyHeaders = daily.headers;
      columns = matchDailyDataColumns(daily.headers, foundation?.resultMetric);
      monthRows = filterCurrentMonth(daily.parsedRows);
      cpaTrend = buildCostTrend(monthRows, columns);
      ctrTrend = buildColumnTrend(monthRows, columns.ctr);
    } catch (e) {
      sheetError = e instanceof Error ? e.message : "Failed to read the Daily Data tab.";
    }
  } else {
    sheetError = "No Mainsheet is linked for this client.";
  }

  const summary = columns ? summarizeDailyRows(monthRows, columns) : null;
  const alertItems = buildAlertItems({
    columns,
    foundation,
    headers: dailyHeaders,
    rows: monthRows,
    summary,
  });

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader
          label="month snapshot"
          className="mb-3"
          action={
            dailyTabTitle ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                {dailyTabTitle}
              </span>
            ) : null
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Ad spend" value={formatInr(summary?.totalSpend ?? null)} />
          <Card label="Revenue" value={formatInr(summary?.totalRevenue ?? null)} accent />
          <Card label={columns?.costLabel ?? "CPL"} value={formatInr(summary?.costPerResult ?? null)} />
          <Card
            label="Open tasks"
            value={String(openTasks ?? 0)}
            hint={`${allTasks ?? 0} total client tasks`}
          />
        </div>
        {sheetError ? (
          <p className="mt-3 text-sm text-red-400">{sheetError}</p>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TrendPanel
          label={`${columns?.costLabel ?? "CPL"} trend`}
          title={`${columns?.costLabel ?? "CPL"} this month`}
          points={cpaTrend}
          valuePrefix="₹"
        />
        <TrendPanel
          label="ctr trend"
          title="CTR this month"
          points={ctrTrend}
          valueSuffix="%"
        />
      </section>

      <section>
        <SectionHeader
          label="red alert"
          className="mb-3"
          action={
            foundation?.tabTitle ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-red-300">
                {foundation.tabTitle}
              </span>
            ) : null
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {alertItems.length > 0 ? (
            alertItems.map((item) => (
              <AlertCard key={item.key} item={item} />
            ))
          ) : (
            <Panel className="p-5 text-sm text-zinc-500 md:col-span-2 xl:col-span-3">
              Add KPI and Goal columns in the Foundation Sheet to show alerts here.
            </Panel>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader label="latest report" className="mb-3" />
          <Panel className="p-5">
            {report ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/admin/clients/${clientId}/reports/${report.id}`}
                    className="font-mono text-sm text-zinc-100 hover:text-orange-400"
                  >
                    {report.week_start_date} → {report.week_end_date}
                  </Link>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    generated {new Date(report.generated_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={report.status} />
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No weekly report generated yet.
              </p>
            )}
          </Panel>
        </div>

        <div>
          <SectionHeader label="sheet health" className="mb-3" />
          <Panel className="space-y-3 p-5 text-sm">
            <Row label="Mainsheet" value={c.mainsheet_file_id ? "linked" : "not linked"} />
            <Row
              label="Sheets connected"
              value={c.sheets_connected_at ? new Date(c.sheets_connected_at).toLocaleString() : "—"}
            />
            <Row label="Rows this month" value={String(monthRows.length)} />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function filterCurrentMonth(rows: DailyDataRow[]): DailyDataRow[] {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  return rows
    .filter((row) => row.iso >= start && row.iso <= end)
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

function buildCostTrend(rows: DailyDataRow[], columns: DailyDataColumns): TrendPoint[] {
  if (columns.costPerResult < 0) return [];
  return rows
    .map((row) => {
      const value = parseNumber(row.row[columns.costPerResult]);
      return value != null ? { label: row.label, value } : null;
    })
    .filter(Boolean) as TrendPoint[];
}

function buildColumnTrend(rows: DailyDataRow[], column: number): TrendPoint[] {
  if (column < 0) return [];
  return rows
    .map((row) => {
      const value = parseNumber(row.row[column]);
      return value != null ? { label: row.label, value } : null;
    })
    .filter(Boolean) as TrendPoint[];
}

type AlertItem = {
  key: string;
  label: string;
  current: number | null;
  target: FoundationKpi | null;
  lowerIsBetter: boolean;
  prefix: string;
  suffix: string;
  source: string;
};

function buildAlertItems({
  columns,
  foundation,
  headers,
  rows,
  summary,
}: {
  columns: DailyDataColumns | null;
  foundation: FoundationSheet | null;
  headers: string[];
  rows: DailyDataRow[];
  summary: ReturnType<typeof summarizeDailyRows> | null;
}): AlertItem[] {
  return (
    foundation?.targets.map((target) => {
      const format = inferAlertFormat(target.label);
      const current = currentForKpi({ columns, headers, rows, summary, target });
      return {
        key: `kpi-${target.label}`,
        label: target.label,
        current,
        target,
        lowerIsBetter: format.lowerIsBetter,
        prefix: format.prefix,
        suffix: format.suffix,
        source: current == null ? "No matching Daily Data column" : "Matched from Daily Data",
      };
    }) ?? []
  );
}

function currentForKpi({
  columns,
  headers,
  rows,
  summary,
  target,
}: {
  columns: DailyDataColumns | null;
  headers: string[];
  rows: DailyDataRow[];
  summary: ReturnType<typeof summarizeDailyRows> | null;
  target: FoundationKpi;
}): number | null {
  if (target.kind === "costPerResult") return summary?.costPerResult ?? null;
  if (target.kind === "ctr") return summary?.avgCtr ?? null;
  if (target.kind === "cpm") return summary?.avgCpm ?? null;

  const direct = averageColumnByLabel(rows, headers, target.label);
  if (direct != null) return direct;
  const targetName = compactMetricName(target.label);
  if (targetName === compactMetricName(columns?.resultLabel ?? "")) {
    return summary?.totalResults ?? null;
  }
  return null;
}

function averageColumnByLabel(
  rows: DailyDataRow[],
  headers: string[],
  label: string,
): number | null {
  const wanted = compactMetricName(label);
  const idx = headers.findIndex((header) => compactMetricName(header) === wanted);
  if (idx < 0) return null;

  const values = rows
    .map((row) => parseNumber(row.row[idx]))
    .filter((value): value is number => value != null);
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function compactMetricName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\\/g, "")
    .replace(/\b(target|goal|ideal|actual|percentage|percent)\b/g, "")
    .replace(/[()%₹$,:/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferAlertFormat(label: string): {
  lowerIsBetter: boolean;
  prefix: string;
  suffix: string;
} {
  const metric = compactMetricName(label);
  const isCost =
    /\bcost\b/.test(metric) ||
    /\bcpp\b/.test(metric) ||
    /\bcpr\b/.test(metric) ||
    /\bcpl\b/.test(metric) ||
    /\bcpm\b/.test(metric) ||
    /\bcpc\b/.test(metric) ||
    metric.includes("spend");
  const isPercent =
    /\bctr\b/.test(metric) ||
    metric.includes("rate") ||
    metric.includes("ratio") ||
    metric.includes("percent");

  return {
    lowerIsBetter: isCost,
    prefix: isCost ? "₹" : "",
    suffix: isPercent ? "%" : "",
  };
}

function AlertCard({ item }: { item: AlertItem }) {
  const currentValue = item.current;
  const targetValue = item.target?.target ?? null;
  const hasData = currentValue != null && targetValue != null;
  const isAlert = hasData
    ? item.lowerIsBetter
      ? currentValue > targetValue
      : currentValue < targetValue
    : false;
  const delta = hasData ? currentValue - targetValue : null;

  return (
    <Panel
      className={`p-4 ${
        isAlert
          ? "border-red-500/50 bg-red-950/20"
          : hasData
            ? "border-emerald-500/30 bg-emerald-950/10"
            : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {item.label}
          </p>
          <p className={`mt-2 font-mono text-xl ${isAlert ? "text-red-300" : "text-zinc-100"}`}>
            {item.current == null
              ? "—"
              : `${item.prefix}${formatCompact(item.current)}${item.suffix}`}
          </p>
        </div>
        <span
          className={`rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${
            isAlert
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : hasData
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 text-zinc-500"
          }`}
        >
          {isAlert ? "Alert" : hasData ? "On track" : "Waiting"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-900 pt-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Current
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {item.current == null
              ? "No matching data"
              : `${item.prefix}${formatCompact(item.current)}${item.suffix}`}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Target
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {item.target?.raw ?? "Add numeric target"}
          </p>
        </div>
      </div>
      {delta != null ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          Gap: {delta > 0 ? "+" : ""}
          {item.prefix}
          {formatCompact(delta)}
          {item.suffix}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-zinc-600">{item.source}</p>
    </Panel>
  );
}

function TrendPanel({
  label,
  title,
  points,
  valuePrefix = "",
  valueSuffix = "",
}: {
  label: string;
  title: string;
  points: TrendPoint[];
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  const latest = points[points.length - 1]?.value ?? null;
  return (
    <div>
      <SectionHeader label={label} className="mb-3" />
      <Panel className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">{title}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {points.length} daily points
            </p>
          </div>
          <p className="font-mono text-lg text-orange-300">
            {latest == null ? "—" : `${valuePrefix}${formatCompact(latest)}${valueSuffix}`}
          </p>
        </div>
        <div className="mt-5">
          {points.length >= 2 ? (
            <Sparkline points={points} valuePrefix={valuePrefix} valueSuffix={valueSuffix} />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-md border border-zinc-900 text-sm text-zinc-500">
              Not enough daily values yet.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Sparkline({
  points,
  valuePrefix = "",
  valueSuffix = "",
}: {
  points: TrendPoint[];
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const coords = points.map((point, i) => {
    const x = points.length === 1 ? 0 : (i / (points.length - 1)) * 100;
    const y = 42 - ((point.value - min) / spread) * 36 - 3;
    return { point, x, y };
  });

  return (
    <div>
      <svg viewBox="0 0 100 48" className="h-32 w-full overflow-visible">
        <polyline
          points={coords.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
          fill="none"
          stroke="rgb(249 115 22)"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
        {coords.map(({ point, x, y }, i) => {
          const valueText = `${valuePrefix}${formatCompact(point.value)}${valueSuffix}`;
          const tooltipText = `${point.label}: ${valueText}`;
          const width = Math.min(44, Math.max(25, tooltipText.length * 1.18));
          const tooltipX = Math.max(1, Math.min(99 - width, x - width / 2));
          const tooltipY = y > 16 ? y - 14 : y + 7;
          return (
            <g key={i} className="group cursor-crosshair">
              <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={width}
                  height="8"
                  rx="1.2"
                  fill="rgb(9 9 11)"
                  stroke="rgb(249 115 22)"
                  strokeOpacity="0.7"
                  strokeWidth="0.4"
                />
                <text
                  x={tooltipX + width / 2}
                  y={tooltipY + 5.2}
                  textAnchor="middle"
                  fill="rgb(255 237 213)"
                  fontSize="3.1"
                  fontFamily="monospace"
                >
                  {tooltipText}
                </text>
              </g>
              <circle cx={x} cy={y} r="1.4" fill="rgb(251 146 60)" />
              <circle cx={x} cy={y} r="5" fill="transparent" pointerEvents="all" />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Panel className={`p-4 ${accent ? "border-orange-500/40 bg-orange-950/15" : ""}`}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-2 font-mono text-xl ${accent ? "text-orange-300" : "text-zinc-100"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-zinc-600">{hint}</p> : null}
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}

function formatInr(value: number | null): string {
  if (value == null) return "—";
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}
