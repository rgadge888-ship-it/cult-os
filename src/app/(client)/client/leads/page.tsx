import { getCurrentClientContext } from "@/lib/sheets/client-context";
import {
  getSheetMetadataAsAgency,
  getSheetValuesAsAgency,
} from "@/lib/google/sheets";
import { Panel, SectionHeader } from "@/components/ui/section";

export default async function ClientLeadsPage() {
  const { client } = await getCurrentClientContext();

  let rows: string[][] = [];
  let headers: string[] = [];
  let err: string | null = null;

  if (client?.mainsheet_file_id) {
    try {
      const meta = await getSheetMetadataAsAgency(client.mainsheet_file_id);
      const tab = meta.tabs.find((t) => /lead/i.test(t.title));
      if (!tab) {
        err = "Couldn't find a Leads tab in your Mainsheet.";
      } else {
        const values = await getSheetValuesAsAgency(
          client.mainsheet_file_id,
          `'${tab.title}'!A1:Z2000`,
          { formatted: true },
        );
        headers = (values[0] ?? []).filter((c) => c.trim() !== "");
        rows = values
          .slice(1)
          .filter((r) => r.some((c) => c.trim() !== ""))
          .reverse() // newest first
          .slice(0, 200);
      }
    } catch (e) {
      err = e instanceof Error ? e.message : "Failed to read the Mainsheet.";
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► leads
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Your leads
        </h1>
        <p className="text-sm text-zinc-500">
          live from your lead capture · {rows.length.toLocaleString("en-IN")} recent
        </p>
      </div>

      <div className="mt-8">
        <SectionHeader
          label="leads"
          className="mb-3"
          action={
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
              live
            </span>
          }
        />
        <Panel className="overflow-hidden">
          {err ? (
            <div className="px-6 py-10 text-center text-sm text-red-400">{err}</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              No leads yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
                    {headers.slice(0, 9).map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-left font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr
                      key={ri}
                      className="border-b border-zinc-900/60 last:border-b-0 hover:bg-zinc-950/60"
                    >
                      {headers.slice(0, 9).map((_, ci) => (
                        <td
                          key={ci}
                          className="max-w-xs truncate px-4 py-2 font-mono text-xs text-zinc-300"
                        >
                          {(r[ci] ?? "").toString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {headers.length > 9 ? (
          <p className="mt-2 text-xs text-zinc-600">
            Showing first 9 columns of {headers.length}. Full row available in your Mainsheet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
