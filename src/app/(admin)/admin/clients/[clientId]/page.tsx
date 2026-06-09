import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSheetMetadataAsAgency, getSheetValuesAsAgency } from "@/lib/google/sheets";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import {
  findHeaderIdx,
  loadDailyDataSheet,
  matchDailyDataColumns,
  summarizeDailyRows,
  type DailyDataColumns,
  type DailyDataRow,
} from "@/lib/sheets/daily-data";
import { loadFoundationSheet, type FoundationKpi, type FoundationSheet } from "@/lib/sheets/foundation";
import { resolveTabTitle } from "@/lib/sheets/tabs";
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
  let foundation: FoundationSheet | null = null;

  if (c.mainsheet_file_id) {
    try {
      foundation = await loadFoundationSheet(c.mainsheet_file_id, c.tab_map);
      const daily = await loadDailyDataSheet(c.mainsheet_file_id, c.tab_map);
      dailyTabTitle = daily.tabTitle;
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
  const osValue = c.mainsheet_file_id
    ? await readMonthlyOs(c.mainsheet_file_id, c.tab_map).catch(() => null)
    : null;

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card label="Ad spend" value={formatInr(summary?.totalSpend ?? null)} />
          <Card label="Revenue" value={formatInr(summary?.totalRevenue ?? null)} accent />
          <Card label={columns?.costLabel ?? "CPL"} value={formatInr(summary?.costPerResult ?? null)} />
          <Card label="OS monthly" value={osValue ?? "—"} hint="Monthly Data OS column" />
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
        <div className="grid gap-4 md:grid-cols-3">
          <AlertCard
            label={columns?.costLabel ?? foundation?.resultMetric ?? "Cost/result"}
            current={summary?.costPerResult ?? null}
            target={foundation?.kpis.costPerResult ?? null}
            lowerIsBetter
            prefix="₹"
          />
          <AlertCard
            label="CTR"
            current={summary?.avgCtr ?? null}
            target={foundation?.kpis.ctr ?? null}
            suffix="%"
          />
          <AlertCard
            label="CPM"
            current={summary?.avgCpm ?? null}
            target={foundation?.kpis.cpm ?? null}
            lowerIsBetter
            prefix="₹"
          />
        </div>
        {foundation?.webinarDateRange || foundation?.goals.length ? (
          <Panel className="mt-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {foundation.webinarDateRange ? (
                <Row label="Webinar range" value={foundation.webinarDateRange} />
              ) : null}
              {foundation.goals.slice(0, 4).map((goal) => (
                <Row key={`${goal.label}-${goal.value}`} label={goal.label} value={goal.value} />
              ))}
            </div>
          </Panel>
        ) : null}
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

async function readMonthlyOs(fileId: string, tabMap: Client["tab_map"]): Promise<string | null> {
  const meta = await getSheetMetadataAsAgency(fileId);
  const monthlyTitle = resolveTabTitle("monthly", tabMap, meta.tabs.map((t) => t.title));
  const monthlyTab = monthlyTitle ? meta.tabs.find((t) => t.title === monthlyTitle) : null;
  if (!monthlyTab) return null;

  const rows = await getSheetValuesAsAgency(fileId, `'${monthlyTab.title}'!A:Z`, {
    formatted: true,
  });
  const hIdx = findHeaderIdx(rows);
  const headers = (rows[hIdx] ?? []).map((h) => h.trim().toLowerCase());
  const osIdx = headers.findIndex(
    (h) =>
      h === "os" ||
      h === "os monthly" ||
      h.includes("overall score") ||
      h.includes("overall status") ||
      h.includes("overall summary"),
  );
  if (osIdx < 0) return null;
  const dataRows = rows.slice(hIdx + 1).filter((r) => r.some((c) => (c ?? "").trim() !== ""));
  const latest = dataRows[dataRows.length - 1];
  return latest ? (latest[osIdx] ?? "").toString().trim() || null : null;
}

function AlertCard({
  label,
  current,
  target,
  lowerIsBetter = false,
  prefix = "",
  suffix = "",
}: {
  label: string;
  current: number | null;
  target: FoundationKpi | null;
  lowerIsBetter?: boolean;
  prefix?: string;
  suffix?: string;
}) {
  const targetValue = target?.target ?? null;
  const hasData = current != null && targetValue != null;
  const isAlert = hasData ? (lowerIsBetter ? current > targetValue : current < targetValue) : false;
  const delta = hasData ? current - targetValue : null;

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
            {label}
          </p>
          <p className={`mt-2 font-mono text-xl ${isAlert ? "text-red-300" : "text-zinc-100"}`}>
            {current == null ? "—" : `${prefix}${formatCompact(current)}${suffix}`}
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
      <p className="mt-3 text-xs text-zinc-500">
        Target: {target?.raw ?? "Add in Foundation Sheet"}
      </p>
      {delta != null ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          Gap: {delta > 0 ? "+" : ""}
          {prefix}
          {formatCompact(delta)}
          {suffix}
        </p>
      ) : null}
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
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <div>
      <svg viewBox="0 0 100 48" className="h-32 w-full overflow-visible">
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="rgb(249 115 22)"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
        {coords.map((coord, i) => {
          const [x, y] = coord.split(",");
          const point = points[i];
          const title = `${point.label}: ${valuePrefix}${formatCompact(point.value)}${valueSuffix}`;
          return (
            <g key={i} className="cursor-crosshair">
              <title>{title}</title>
              <circle cx={x} cy={y} r="1.4" fill="rgb(251 146 60)" />
              <circle cx={x} cy={y} r="4.5" fill="transparent" />
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
