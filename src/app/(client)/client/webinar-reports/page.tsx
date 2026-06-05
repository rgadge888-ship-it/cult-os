import Link from "next/link";
import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { resolveTabTitle } from "@/lib/sheets/tabs";
import { Panel, SectionHeader } from "@/components/ui/section";

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

function col(headers: string[], ...needles: string[]): number {
  const h = headers.map((x) => x.toLowerCase());
  return h.findIndex((x) => needles.some((n) => x.includes(n)));
}

export default async function ClientWebinarReportsPage() {
  const { client } = await getCurrentClientContext();

  let webinars: {
    date: string;
    registrations: string;
    attendees: string;
    attendeesPct: string;
    retention50: string;
    retentionPitch: string;
    retentionEnd: string;
    converted: string;
    convRate: string;
    revenue: string;
  }[] = [];
  let err: string | null = null;

  if (client?.mainsheet_file_id) {
    try {
      const meta = await getSheetMetadataAsAgency(client.mainsheet_file_id);
      const _titles = meta.tabs.map((t) => t.title);
      const _tabTitle = resolveTabTitle("webinar", client.tab_map, _titles);
      const tab = _tabTitle ? meta.tabs.find((t) => t.title === _tabTitle) : null;
      if (!tab) {
        err = "Couldn't find a Webinar Data tab in your Mainsheet.";
      } else {
        const values = await getSheetValuesAsAgency(
          client.mainsheet_file_id,
          `'${tab.title}'!A:AZ`,
          { formatted: true },
        );
        const hIdx = findHeaderIdx(values);
        const headers = values[hIdx] ?? [];
        const iDate = col(headers, "webinar date", "date");
        const iReg = col(headers, "registration");
        const iAtt = col(headers, "max attedee", "max attendee", "attendees");
        const iAttPct = headers.findIndex((h) =>
          /attendees\s*[%(]/i.test(h),
        );
        const i50 = col(headers, "stayed till 50%(percentage)", "stayed till 50% (percentage)");
        const iPitch = col(headers, "stayed till pitch(percentage)", "pitch (percentage)");
        const iEnd = headers.findIndex((h) =>
          /pitch end.*percentage|pitch end\s*%/i.test(h),
        );
        const iConv = col(headers, "total converted", "converted");
        const iCR = col(headers, "conversion rate");
        const iRev = col(headers, "total revenue", "revenue");

        const data = values
          .slice(hIdx + 1)
          .filter((r) => iDate >= 0 && (r[iDate] ?? "").trim() !== "")
          .reverse();

        webinars = data.map((r) => ({
          date: (r[iDate] ?? "").toString(),
          registrations: iReg >= 0 ? (r[iReg] ?? "").toString() : "",
          attendees: iAtt >= 0 ? (r[iAtt] ?? "").toString() : "",
          attendeesPct: iAttPct >= 0 ? (r[iAttPct] ?? "").toString() : "",
          retention50: i50 >= 0 ? (r[i50] ?? "").toString() : "",
          retentionPitch: iPitch >= 0 ? (r[iPitch] ?? "").toString() : "",
          retentionEnd: iEnd >= 0 ? (r[iEnd] ?? "").toString() : "",
          converted: iConv >= 0 ? (r[iConv] ?? "").toString() : "",
          convRate: iCR >= 0 ? (r[iCR] ?? "").toString() : "",
          revenue: iRev >= 0 ? (r[iRev] ?? "").toString() : "",
        }));
      }
    } catch (e) {
      err = e instanceof Error ? e.message : "Failed to read the Mainsheet.";
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► webinars
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Webinar Reports
        </h1>
        <p className="text-sm text-zinc-500">
          every session you've run, with the funnel inside the call
        </p>
      </div>

      <div className="mt-8">
        <SectionHeader label="history" className="mb-3" />
        {err ? (
          <Panel className="px-6 py-10 text-center text-sm text-red-400">{err}</Panel>
        ) : webinars.length === 0 ? (
          <Panel className="px-6 py-10 text-center text-sm text-zinc-500">
            No webinars logged yet.
          </Panel>
        ) : (
          <div className="space-y-4">
            {webinars.map((w, i) => (
              <Panel key={i} className="p-5 transition-colors hover:border-zinc-700">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-zinc-500">
                      {w.date || "—"}
                    </p>
                    <p className="font-mono text-xl text-zinc-100">
                      {w.registrations || "—"}{" "}
                      <span className="font-sans text-xs text-zinc-500">registered</span>
                    </p>
                  </div>
                  <div className="flex items-baseline gap-6">
                    <div className="text-right">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        revenue
                      </p>
                      <p className="font-mono text-lg text-orange-300">
                        {w.revenue || "—"}
                      </p>
                    </div>
                    <Link
                      href={`/client/webinar-reports/${i}`}
                      className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-[10px] uppercase tracking-widest text-zinc-300 hover:border-orange-500 hover:text-orange-300"
                    >
                      view full →
                    </Link>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Stat label="Attendees" value={w.attendees} pct={w.attendeesPct} />
                  <Stat label="Stayed → 50%" value={w.retention50} pctSuffix />
                  <Stat label="Stayed → pitch" value={w.retentionPitch} pctSuffix />
                  <Stat label="Stayed → end" value={w.retentionEnd} pctSuffix />
                  <Stat label="Converted" value={w.converted} pct={w.convRate} />
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  pct,
  pctSuffix,
}: {
  label: string;
  value: string;
  pct?: string;
  pctSuffix?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="font-mono text-base text-zinc-100">{value || "—"}</p>
      {pct ? (
        <p className="font-mono text-[10px] text-zinc-500">{pct}</p>
      ) : pctSuffix && value ? null : null}
    </div>
  );
}
