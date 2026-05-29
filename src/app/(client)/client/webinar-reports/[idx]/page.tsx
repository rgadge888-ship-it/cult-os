import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { Panel, SectionHeader } from "@/components/ui/section";
import { parseNumber } from "@/lib/reports/parse";

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

// Find a header column by fuzzy contains-match.
function findCol(headers: string[], ...needles: string[]): number {
  const h = headers.map((x) => x.toLowerCase());
  return h.findIndex((x) => needles.some((n) => x.includes(n)));
}

// Decide whether a percent value is good / mediocre / bad for the bar color.
function pctClass(p: number | null, goodAbove = 50, badBelow = 30): string {
  if (p == null) return "bg-zinc-700";
  if (p >= goodAbove) return "bg-emerald-500";
  if (p < badBelow) return "bg-red-500";
  return "bg-amber-500";
}

export default async function WebinarDetailPage({
  params,
}: {
  params: Promise<{ idx: string }>;
}) {
  const { idx } = await params;
  const targetIdx = Number.parseInt(idx, 10);
  if (Number.isNaN(targetIdx) || targetIdx < 0) notFound();

  const { client } = await getCurrentClientContext();
  if (!client?.mainsheet_file_id) notFound();

  const meta = await getSheetMetadataAsAgency(client.mainsheet_file_id);
  const tab = meta.tabs.find((t) => /webinar/i.test(t.title));
  if (!tab) notFound();

  const values = await getSheetValuesAsAgency(
    client.mainsheet_file_id,
    `'${tab.title}'!A1:AZ200`,
    { formatted: true },
  );
  const hIdx = findHeaderIdx(values);
  const headers = (values[hIdx] ?? []).map((h) => h.trim());
  const dataRows = values
    .slice(hIdx + 1)
    .filter((r) => r.some((c) => (c ?? "").toString().trim() !== ""));

  // Match the list page: rows reversed so newest = index 0.
  const reversed = [...dataRows].reverse();
  const row = reversed[targetIdx];
  if (!row) notFound();

  // Column lookup
  const c = (...needles: string[]) => findCol(headers, ...needles);
  const get = (idx: number) => (idx >= 0 ? (row[idx] ?? "").toString().trim() : "");

  const iDate = c("webinar date", "date");
  const iReg = c("registration");
  const iAtt = c("max attedee", "max attendee", "attendees");
  const iAttPct = headers.findIndex((h) => /attendees\s*[%(]/i.test(h));
  const iS50Count = headers.findIndex((h) => /^stayed till 50%$/i.test(h.trim()));
  const iS50Pct = c("stayed till 50%(percentage)", "stayed till 50% (percentage)");
  const iSPCount = headers.findIndex((h) => /stayed till pitch start/i.test(h));
  const iSPPct = c("stayed till pitch(percentage)", "pitch (percentage)");
  const iSECount = headers.findIndex(
    (h, idx) => /stayed till pitch end/i.test(h) && idx !== iSPCount,
  );
  const iSEPct = headers.findIndex(
    (h) => /pitch end.*percentage|pitch end\s*%/i.test(h),
  );
  const iUpsell = c("upsell");
  const iCallBooking = c("call booking");
  const iConverted = c("total converted", "converted");
  const iConvRate = c("conversion rate");
  const iConvLow = c("conversion at low");
  const iSilver = c("silver price");
  const iCallBookPrice = c("call bookin price", "call booking price");
  const iAdSpent = headers.findIndex((h) => /^ad spent$/i.test(h.trim()));
  const iAdSpentGst = c("ad spent with gst");
  const iRevenue = c("total revenue", "revenue");
  const iProfit = c("gross profit", "net profit", "profit");
  const iRoas = c("roas");
  const iObjections = c("objections");
  const iEngagement = c("engagement");
  const iAudience = c("audience quality");
  const iImprovements = c("improvements");

  const date = get(iDate) || "—";
  const reg = parseNumber(get(iReg));
  const att = parseNumber(get(iAtt));
  const s50 = parseNumber(get(iS50Count));
  const sp = parseNumber(get(iSPCount));
  const se = parseNumber(get(iSECount));
  const conv = parseNumber(get(iConverted));

  // Funnel steps for the visualization
  const funnel = [
    { label: "Registered", value: reg, raw: get(iReg) },
    { label: "Attended", value: att, raw: get(iAtt) },
    { label: "Stayed → 50%", value: s50, raw: get(iS50Count) },
    { label: "Stayed → Pitch", value: sp, raw: get(iSPCount) },
    { label: "Stayed → End", value: se, raw: get(iSECount) },
    { label: "Converted", value: conv, raw: get(iConverted) },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value ?? 0));

  // Drop-off percentages between consecutive funnel steps
  const dropOffs: (number | null)[] = funnel.map((f, i) => {
    if (i === 0) return null;
    const prev = funnel[i - 1].value;
    if (prev == null || prev === 0 || f.value == null) return null;
    return (f.value / prev) * 100;
  });

  const retention = [
    { label: "Stayed → 50%", pct: parseNumber(get(iS50Pct)), raw: get(iS50Pct) },
    { label: "Stayed → Pitch", pct: parseNumber(get(iSPPct)), raw: get(iSPPct) },
    { label: "Stayed → End", pct: parseNumber(get(iSEPct)), raw: get(iSEPct) },
  ];

  // All columns shown raw at the bottom
  const allRows: { label: string; value: string }[] = headers
    .map((h, i) => ({ label: h, value: (row[i] ?? "").toString().trim() }))
    .filter((r) => r.label && r.value);

  const qualitative = [
    { label: "Objections", value: get(iObjections) },
    { label: "Engagement", value: get(iEngagement) },
    { label: "Audience quality", value: get(iAudience) },
    { label: "Improvements", value: get(iImprovements) },
  ].filter((q) => q.value);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        href="/client/webinar-reports"
        className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        ← All webinars
      </Link>

      <div className="mt-3 mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► webinar
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{date}</h1>
      </div>

      {/* Hero stats */}
      <Panel className="mb-8 grid gap-4 p-6 sm:grid-cols-4">
        <Hero label="Registered" value={get(iReg)} />
        <Hero label="Revenue" value={get(iRevenue)} accent />
        <Hero label="ROAS" value={get(iRoas)} />
        <Hero label="Gross Profit" value={get(iProfit)} />
      </Panel>

      {/* The Funnel */}
      <div className="mb-8">
        <SectionHeader label="the funnel" className="mb-3" />
        <Panel className="p-6">
          <ul className="space-y-3">
            {funnel.map((f, i) => {
              const w = f.value != null ? Math.max(2, (f.value / maxFunnel) * 100) : 2;
              const drop = dropOffs[i];
              return (
                <li key={f.label} className="space-y-1">
                  {drop != null ? (
                    <p className="ml-2 font-mono text-[10px] text-zinc-600">
                      ↓ {drop.toFixed(0)}% retained from {funnel[i - 1].label}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-12 items-center gap-3">
                    <span className="col-span-3 text-sm text-zinc-300">{f.label}</span>
                    <div className="col-span-6 h-6 overflow-hidden rounded-md bg-zinc-900">
                      <div
                        className={`h-full rounded-md ${i === 0 ? "bg-orange-500/80" : i === funnel.length - 1 ? "bg-emerald-500/80" : "bg-zinc-600"}`}
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className="col-span-3 text-right font-mono text-sm text-zinc-100">
                      {f.raw || "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* Retention curve */}
      <div className="mb-8">
        <SectionHeader label="retention curve" className="mb-3" />
        <Panel className="space-y-3 p-6">
          {retention.map((r) => {
            const w = r.pct != null ? Math.min(100, Math.max(2, r.pct)) : 2;
            return (
              <div key={r.label} className="grid grid-cols-12 items-center gap-3">
                <span className="col-span-3 text-sm text-zinc-300">{r.label}</span>
                <div className="col-span-7 h-3 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className={`h-full ${pctClass(r.pct, 60, 30)}`}
                    style={{ width: `${w}%` }}
                  />
                </div>
                <span className="col-span-2 text-right font-mono text-sm text-zinc-100">
                  {r.raw || "—"}
                </span>
              </div>
            );
          })}
        </Panel>
      </div>

      {/* Conversion + revenue grid */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader label="conversion" className="mb-3" />
          <Panel className="grid gap-3 p-5 sm:grid-cols-2">
            <Field label="Upsell" value={get(iUpsell)} />
            <Field label="Call Booking" value={get(iCallBooking)} />
            <Field label="Total Converted" value={get(iConverted)} />
            <Field label="Conversion Rate" value={get(iConvRate)} />
            <Field label="Conv. at low point" value={get(iConvLow)} />
          </Panel>
        </div>
        <div>
          <SectionHeader label="revenue + spend" className="mb-3" />
          <Panel className="grid gap-3 p-5 sm:grid-cols-2">
            <Field label="Silver Price" value={get(iSilver)} />
            <Field label="Call Booking Price" value={get(iCallBookPrice)} />
            <Field label="Ad Spent" value={get(iAdSpent)} />
            <Field label="Ad Spent + GST" value={get(iAdSpentGst)} />
            <Field label="Total Revenue" value={get(iRevenue)} accent />
            <Field label="Gross Profit" value={get(iProfit)} accent />
          </Panel>
        </div>
      </div>

      {/* Qualitative notes */}
      {qualitative.length > 0 ? (
        <div className="mb-8">
          <SectionHeader label="observations" className="mb-3" />
          <Panel className="space-y-4 p-5">
            {qualitative.map((q) => (
              <div key={q.label}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {q.label}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{q.value}</p>
              </div>
            ))}
          </Panel>
        </div>
      ) : null}

      {/* All columns raw */}
      <div className="mb-8">
        <SectionHeader
          label="all data · every column"
          className="mb-3"
          action={
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {allRows.length} fields
            </span>
          }
        />
        <Panel>
          <table className="w-full text-sm">
            <tbody>
              {allRows.map((r, i) => (
                <tr key={i} className="border-b border-zinc-900/60 last:border-b-0">
                  <td className="w-1/2 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                    {r.label}
                  </td>
                  <td className="px-4 py-2 font-mono text-sm text-zinc-200">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function Hero({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl ${accent ? "text-orange-300" : "text-zinc-100"}`}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-sm ${accent ? "text-orange-300" : "text-zinc-100"}`}>
        {value || "—"}
      </p>
    </div>
  );
}
