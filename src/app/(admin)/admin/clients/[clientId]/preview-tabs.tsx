import { Panel, SectionHeader } from "@/components/ui/section";
import { getGoogleConnectionStatus } from "@/lib/google/status";
import { getSheetMetadata, getTabHeaderRows } from "@/lib/google/sheets";
import { TAB_ROLES, autoGuess, type TabRole } from "@/lib/sheets/tabs";
import { TabMapForm } from "./tab-map-form";

// Tab mapping panel — reads the live tab list + lets the admin pin each
// canonical role to an actual tab. Sits above the preview on the client page.
export async function MainsheetTabMapping({
  userId,
  clientId,
  fileId,
  tabMap,
}: {
  userId: string;
  clientId: string;
  fileId: string | null;
  tabMap: Record<string, string>;
}) {
  if (!fileId) return null;
  const status = await getGoogleConnectionStatus(userId);
  if (!status.connected) return null;

  let titles: string[] = [];
  try {
    const meta = await getSheetMetadata(userId, fileId);
    titles = meta.tabs.map((t) => t.title);
  } catch {
    return null;
  }
  if (titles.length === 0) return null;

  const guesses: Partial<Record<TabRole, string | null>> = {};
  for (const { role } of TAB_ROLES) guesses[role] = autoGuess(role, titles);

  return (
    <div>
      <SectionHeader label="tab mapping" className="mb-3" />
      <Panel>
        <TabMapForm
          clientId={clientId}
          availableTitles={titles}
          current={tabMap ?? {}}
          guesses={guesses}
        />
      </Panel>
    </div>
  );
}

export async function MainsheetPreview({
  userId,
  fileId,
}: {
  userId: string;
  fileId: string | null;
}) {
  if (!fileId) {
    return (
      <div>
        <SectionHeader label="mainsheet preview" className="mb-3" />
        <Panel className="px-5 py-6 text-center text-sm text-zinc-500">
          No Mainsheet file linked. Add a URL in client settings.
        </Panel>
      </div>
    );
  }

  const status = await getGoogleConnectionStatus(userId);
  if (!status.connected) {
    return (
      <div>
        <SectionHeader label="mainsheet preview" className="mb-3" />
        <Panel className="space-y-3 px-5 py-6 text-sm text-zinc-400">
          <p>
            Google Sheets isn't connected yet. Once you connect, Cult OS can read this
            Mainsheet's tabs and columns.
          </p>
          <a
            href="/admin/settings"
            className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400"
          >
            Connect Google Sheets →
          </a>
        </Panel>
      </div>
    );
  }

  let meta: Awaited<ReturnType<typeof getSheetMetadata>> | null = null;
  let headers: Record<string, string[][]> = {};
  let errorMsg: string | null = null;
  try {
    meta = await getSheetMetadata(userId, fileId);
    headers = await getTabHeaderRows(
      userId,
      fileId,
      meta.tabs.map((t) => t.title),
      2,
    );
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : "unknown error";
  }

  return (
    <div>
      <SectionHeader
        label="mainsheet preview"
        className="mb-3"
        action={
          meta ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
              live · {meta.tabs.length} tabs
            </span>
          ) : null
        }
      />
      <Panel className="p-5">
        {errorMsg ? (
          <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            Failed to read sheet: <span className="font-mono">{errorMsg}</span>
          </div>
        ) : meta ? (
          <div className="space-y-5">
            <div className="space-y-1 text-sm">
              <p className="text-zinc-100">{meta.title}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                {meta.locale ?? "—"} · {meta.timeZone ?? "—"}
              </p>
            </div>

            <ul className="space-y-3">
              {meta.tabs.map((t) => {
                const rows = headers[t.title] ?? [];
                // Pick the row that looks most like a header (more non-empty cells).
                const headerRow =
                  rows.length === 0
                    ? []
                    : rows.reduce((best, r) =>
                        r.filter(Boolean).length > best.filter(Boolean).length ? r : best,
                      );
                const cols = headerRow.filter(Boolean);
                return (
                  <li
                    key={t.sheetId}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-zinc-200">{t.title}</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        {t.rowCount.toLocaleString()} rows · {cols.length} cols detected
                      </span>
                    </div>
                    {cols.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cols.slice(0, 40).map((c, i) => (
                          <span
                            key={`${t.sheetId}-${i}`}
                            className="rounded-sm border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-[10px] text-zinc-600">
                        no header row detected in rows 1–2
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="text-xs text-zinc-600">
              These are the live column headers Cult OS sees. The report generator maps
              them (fuzzily) to canonical fields like spend, registrations, CPR/CPP, etc.
            </p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
