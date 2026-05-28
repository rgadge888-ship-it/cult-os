import type {
  MetricCell,
  MetricField,
  WeeklyReportData,
} from "@/lib/db/types";
import { FIELD_LABELS, HIGHER_IS_BETTER } from "@/lib/reports/parse";
import { Panel, SectionHeader } from "@/components/ui/section";

// Compute a week-over-week delta badge for a field.
function Delta({
  field,
  cur,
  prev,
}: {
  field: MetricField;
  cur?: MetricCell;
  prev?: MetricCell;
}) {
  if (!cur || !prev || cur.value == null || prev.value == null || prev.value === 0) {
    return null;
  }
  const pct = ((cur.value - prev.value) / Math.abs(prev.value)) * 100;
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.5) return null;
  const up = pct > 0;
  const better = HIGHER_IS_BETTER[field];
  const good = better === undefined ? null : better === up;
  const color =
    good === null ? "text-zinc-500" : good ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`font-mono text-[10px] ${color}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function fmt(cell?: MetricCell): string {
  if (!cell || cell.raw === "") return "—";
  return cell.raw;
}

// The ordered list of fields shown in the metrics table.
const TABLE_FIELDS: MetricField[] = [
  "spend_with_gst",
  "registrations",
  "cost_per_acq",
  "impressions",
  "obc",
  "ctr",
  "cpc",
  "lpv",
  "cpm",
  "upsells",
  "revenue",
  "net_profit",
  "roas",
  "obc_to_lpv",
  "lpv_to_reg",
];

export function ReportNarrative({
  narrative,
  discussion,
  mom,
}: {
  narrative: string | null;
  discussion: string | null;
  mom: string | null;
}) {
  if (!narrative && !discussion && !mom) return null;
  return (
    <div className="space-y-6">
      {discussion ? (
        <div>
          <SectionHeader label="points to be discussed" className="mb-3" />
          <Panel className="whitespace-pre-wrap p-5 text-sm text-zinc-300">
            {discussion}
          </Panel>
        </div>
      ) : null}
      {mom ? (
        <div>
          <SectionHeader label="minutes of meeting" className="mb-3" />
          <Panel className="whitespace-pre-wrap p-5 text-sm text-zinc-300">{mom}</Panel>
        </div>
      ) : null}
    </div>
  );
}

export function WeeklyReportView({
  clientName,
  data,
}: {
  clientName: string;
  data: WeeklyReportData;
}) {
  const cur = data.current.metrics;
  const prev = data.previous?.metrics;

  // Registrations rendered as "total(FB)" when both exist.
  const regCell = cur.registrations;
  const regFb = cur.registrations_fb;
  const regDisplay =
    regCell && regFb?.raw
      ? `${fmt(regCell)} (${fmt(regFb)})`
      : fmt(regCell);

  return (
    <div className="space-y-8">
      {/* Header band */}
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-orange-500">
              ► weekly report
            </p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-100">{clientName}</h2>
            <p className="font-mono text-xs text-zinc-500">{data.current.range}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
            <KeyStat label="Spend" cell={cur.spend_with_gst} field="spend_with_gst" prev={prev?.spend_with_gst} />
            <KeyStat label={data.acq_label} cell={cur.cost_per_acq} field="cost_per_acq" prev={prev?.cost_per_acq} />
            <KeyStat label="ROAS" cell={cur.roas} field="roas" prev={prev?.roas} />
            <KeyStat label="Net P/L" cell={cur.net_profit} field="net_profit" prev={prev?.net_profit} />
          </div>
        </div>
      </Panel>

      {/* Funnel */}
      <div>
        <SectionHeader label="the funnel" className="mb-3" />
        <Panel className="p-6">
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <FunnelStep label="Impressions" value={data.funnel.impressions} />
            <Arrow />
            <FunnelStep label="OBC" value={data.funnel.obc} />
            <Arrow />
            <FunnelStep label="LPV" value={data.funnel.lpv} />
            <Arrow />
            <FunnelStep label="Registrations" value={data.funnel.registrations} accent />
            {data.latest_webinar ? (
              <>
                <Arrow />
                <FunnelStep label="Attendees" value={data.latest_webinar.attendees} />
                <Arrow />
                <FunnelStep label="Converted" value={data.latest_webinar.converted} accent />
              </>
            ) : null}
          </div>
          {data.latest_webinar ? (
            <p className="mt-3 text-[11px] text-zinc-600">
              Attendees / Converted from latest webinar
              {data.latest_webinar.date ? ` (${data.latest_webinar.date})` : ""}.
            </p>
          ) : null}
        </Panel>
      </div>

      {/* Metrics table: current vs last week */}
      <div>
        <SectionHeader
          label="fb · current vs last week"
          className="mb-3"
          action={
            data.previous ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                vs {data.previous.range}
              </span>
            ) : null
          }
        />
        <Panel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-2.5 text-left font-normal">Metric</th>
                <th className="px-4 py-2.5 text-right font-normal">This week</th>
                <th className="px-4 py-2.5 text-right font-normal">Last week</th>
                <th className="px-4 py-2.5 text-right font-normal">Δ</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_FIELDS.map((field) => {
                const c = cur[field];
                if (!c || c.raw === "") return null;
                const p = prev?.[field];
                const label =
                  field === "cost_per_acq" ? data.acq_label : FIELD_LABELS[field];
                const thisVal =
                  field === "registrations" ? regDisplay : fmt(c);
                return (
                  <tr key={field} className="border-b border-zinc-900/60 last:border-b-0">
                    <td className="px-4 py-2.5 text-zinc-300">{label}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-100">
                      {thisVal}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-500">
                      {fmt(p)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Delta field={field} cur={c} prev={p} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Top creatives */}
      {data.top_creatives.length > 0 ? (
        <div>
          <SectionHeader label="top creatives" className="mb-3" />
          <Panel>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="px-4 py-2.5 text-left font-normal">Creative</th>
                  <th className="px-4 py-2.5 text-right font-normal">Spend</th>
                  <th className="px-4 py-2.5 text-right font-normal">Regs</th>
                  <th className="px-4 py-2.5 text-right font-normal">{data.acq_label}</th>
                  <th className="px-4 py-2.5 text-right font-normal">Hook</th>
                  <th className="px-4 py-2.5 text-right font-normal">CTR</th>
                </tr>
              </thead>
              <tbody>
                {data.top_creatives.map((cr, i) => (
                  <tr key={i} className="border-b border-zinc-900/60 last:border-b-0">
                    <td className="max-w-xs truncate px-4 py-2.5 text-zinc-200">{cr.name}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{cr.spend ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{cr.registrations ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{cr.cost_per_acq ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{cr.hook_rate ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{cr.ctr ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      ) : null}

      {data.warnings.length > 0 ? (
        <Panel className="border-amber-900/50 bg-amber-950/20 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500">
            generator notes
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-300/80">
            {data.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function KeyStat({
  label,
  cell,
  field,
  prev,
}: {
  label: string;
  cell?: MetricCell;
  field: MetricField;
  prev?: MetricCell;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-lg text-zinc-100">{fmt(cell)}</span>
        <Delta field={field} cur={cell} prev={prev} />
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | null;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        accent ? "border-orange-500/40 bg-orange-950/20" : "border-zinc-800 bg-zinc-950/60"
      }`}
    >
      <p className="text-[9px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`text-sm ${accent ? "text-orange-300" : "text-zinc-200"}`}>
        {value == null ? "—" : value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function Arrow() {
  return <span className="text-zinc-700">→</span>;
}
