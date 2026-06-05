import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { resolveTabTitle } from "@/lib/sheets/tabs";
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

function col(headers: string[], ...needles: string[]): number {
  const h = headers.map((x) => x.toLowerCase());
  return h.findIndex((x) => needles.some((n) => x.includes(n)));
}

export default async function ClientCreativesPage() {
  const { client } = await getCurrentClientContext();

  let rows: {
    name: string;
    status: string;
    spend: string;
    registrations: string;
    cpr: string;
    hook: string;
    hold: string;
    ctr: string;
    _spend: number;
  }[] = [];
  let err: string | null = null;

  if (client?.mainsheet_file_id) {
    try {
      const meta = await getSheetMetadataAsAgency(client.mainsheet_file_id);
      const _titles = meta.tabs.map((t) => t.title);
      const _tabTitle = resolveTabTitle("creative", client.tab_map, _titles);
      const tab = _tabTitle ? meta.tabs.find((t) => t.title === _tabTitle) : null;
      if (!tab) {
        err = "Couldn't find a Creative Tracking tab in your Mainsheet.";
      } else {
        const values = await getSheetValuesAsAgency(
          client.mainsheet_file_id,
          `'${tab.title}'!A:BZ`,
          { formatted: true },
        );
        const hIdx = findHeaderIdx(values);
        const headers = values[hIdx] ?? [];
        const iName = col(headers, "ad name", "video name", "nomenclature");
        const iStatus = col(headers, "ad status", "video usage status");
        const iSpend = col(headers, "amount spent", "spend");
        const iReg = col(headers, "registrations", "registration");
        const iCpr = col(headers, "cpr", "cpp");
        const iHook = col(headers, "hook rate");
        const iHold = col(headers, "hold rate");
        const iCtr = col(headers, "ctr");

        rows = values
          .slice(hIdx + 1)
          .filter((r) => iName >= 0 && (r[iName] ?? "").trim() !== "")
          .map((r) => ({
            name: iName >= 0 ? (r[iName] ?? "").toString() : "",
            status: iStatus >= 0 ? (r[iStatus] ?? "").toString() : "",
            spend: iSpend >= 0 ? (r[iSpend] ?? "").toString() : "",
            registrations: iReg >= 0 ? (r[iReg] ?? "").toString() : "",
            cpr: iCpr >= 0 ? (r[iCpr] ?? "").toString() : "",
            hook: iHook >= 0 ? (r[iHook] ?? "").toString() : "",
            hold: iHold >= 0 ? (r[iHold] ?? "").toString() : "",
            ctr: iCtr >= 0 ? (r[iCtr] ?? "").toString() : "",
            _spend: iSpend >= 0 ? parseNumber(r[iSpend]) ?? 0 : 0,
          }))
          .sort((a, b) => b._spend - a._spend);
      }
    } catch (e) {
      err = e instanceof Error ? e.message : "Failed to read the Mainsheet.";
    }
  }

  const active = rows.filter((r) => /active|live|running/i.test(r.status));
  const paused = rows.filter((r) => !/active|live|running/i.test(r.status));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► creatives
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Ads & Creatives
        </h1>
        <p className="text-sm text-zinc-500">
          every creative running for you · sorted by spend
        </p>
      </div>

      {err ? (
        <Panel className="mt-8 px-6 py-10 text-center text-sm text-red-400">{err}</Panel>
      ) : rows.length === 0 ? (
        <Panel className="mt-8 px-6 py-10 text-center text-sm text-zinc-500">
          No creatives logged yet.
        </Panel>
      ) : (
        <div className="mt-8 space-y-8">
          {active.length > 0 ? (
            <CreativeTable label="active" rows={active} />
          ) : null}
          {paused.length > 0 ? (
            <CreativeTable label="other" rows={paused} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function CreativeTable({
  label,
  rows,
}: {
  label: string;
  rows: {
    name: string;
    status: string;
    spend: string;
    registrations: string;
    cpr: string;
    hook: string;
    hold: string;
    ctr: string;
  }[];
}) {
  return (
    <div>
      <SectionHeader label={label} className="mb-3" />
      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="px-4 py-2.5 text-left font-normal">Creative</th>
                <th className="px-4 py-2.5 text-left font-normal">Status</th>
                <th className="px-4 py-2.5 text-right font-normal">Spend</th>
                <th className="px-4 py-2.5 text-right font-normal">Regs</th>
                <th className="px-4 py-2.5 text-right font-normal">CPR</th>
                <th className="px-4 py-2.5 text-right font-normal">Hook</th>
                <th className="px-4 py-2.5 text-right font-normal">Hold</th>
                <th className="px-4 py-2.5 text-right font-normal">CTR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-zinc-900/60 last:border-b-0">
                  <td className="max-w-xs truncate px-4 py-2.5 text-zinc-200">
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    {r.status || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                    {r.spend || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                    {r.registrations || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                    {r.cpr || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                    {r.hook || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                    {r.hold || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                    {r.ctr || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
