import { google, type sheets_v4 } from "googleapis";
import type { Credentials } from "google-auth-library";
import { unstable_cache } from "next/cache";
import { getOAuthClient } from "./oauth";
import { getTokensForUser, saveTokensForUser } from "./tokens";
import { createAdminClient } from "@/lib/supabase/admin";

// Return the user id of the designated "agency reader" — i.e. whichever admin
// has Google Sheets connected. Client-side pages use this so they can read the
// Mainsheet even though the client themselves never connected Google. Picks the
// oldest token whose owner is an admin/super_admin.
//
// Note: google_oauth_tokens has no direct FK to public.profiles (both reference
// auth.users separately), so PostgREST can't auto-join. We query in two steps.
async function getDesignatedReaderId(): Promise<string | null> {
  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from("google_oauth_tokens")
    .select("user_id, created_at")
    .order("created_at", { ascending: true });
  if (!tokens || tokens.length === 0) return null;

  const userIds = tokens.map((t) => t.user_id).filter(Boolean) as string[];
  const { data: adminRows } = await admin
    .from("profiles")
    .select("id")
    .in("id", userIds)
    .in("role", ["admin", "super_admin"]);
  const adminSet = new Set((adminRows ?? []).map((r) => r.id));
  const first = tokens.find((t) => t.user_id && adminSet.has(t.user_id));
  return first?.user_id ?? null;
}

// Wrapper used by client-portal pages that need to read the Mainsheet. Resolves
// to the agency's reader token transparently.
export async function getAgencySheetsClient(): Promise<sheets_v4.Sheets> {
  const id = await getDesignatedReaderId();
  if (!id) throw new Error("google_not_connected");
  return getSheetsClientForUser(id);
}

export async function getAgencyReaderId(): Promise<string | null> {
  return getDesignatedReaderId();
}

// Cached inner reads. unstable_cache memoises across requests + dedupes within
// a single render pass. TTL: metadata 5 min (tabs rarely change), values 60s
// (data drifts as new rows come in, but client UX needs snappiness).
const cachedMetadata = unstable_cache(
  async (userId: string, fileId: string) => getSheetMetadata(userId, fileId),
  ["sheet-metadata-v1"],
  { revalidate: 300, tags: ["sheets:metadata"] },
);

const cachedValues = unstable_cache(
  async (
    userId: string,
    fileId: string,
    range: string,
    formatted: boolean,
  ): Promise<string[][]> => getSheetValues(userId, fileId, range, { formatted }),
  ["sheet-values-v1"],
  { revalidate: 60, tags: ["sheets:values"] },
);

// Batched read: one HTTP call to the Sheets API, multiple ranges back. Cache
// key is a sorted+joined ranges list so order-doesn't-matter requests share an
// entry.
const cachedBatchValues = unstable_cache(
  async (
    userId: string,
    fileId: string,
    rangesKey: string,
    formatted: boolean,
  ): Promise<Record<string, string[][]>> => {
    const sheets = await getSheetsClientForUser(userId);
    const ranges = rangesKey.split("");
    const { data } = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: fileId,
      ranges,
      valueRenderOption: formatted ? "FORMATTED_VALUE" : "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const out: Record<string, string[][]> = {};
    (data.valueRanges ?? []).forEach((vr, i) => {
      out[ranges[i]] = (vr.values ?? []).map((row) =>
        (row ?? []).map((c) => String(c ?? "")),
      );
    });
    return out;
  },
  ["sheet-batch-v1"],
  { revalidate: 60, tags: ["sheets:values"] },
);

// Agency-token wrappers used by client-portal pages. Each first resolves the
// reader user id, then hits the cached inner function.
export async function getSheetMetadataAsAgency(fileId: string) {
  const id = await getDesignatedReaderId();
  if (!id) throw new Error("google_not_connected");
  return cachedMetadata(id, fileId);
}

export async function getSheetValuesAsAgency(
  fileId: string,
  range: string,
  opts?: { formatted?: boolean },
) {
  const id = await getDesignatedReaderId();
  if (!id) throw new Error("google_not_connected");
  return cachedValues(id, fileId, range, !!opts?.formatted);
}

// Read many ranges in ONE HTTP call. Returns { [range]: rows[][] }.
export async function getSheetValuesBatchAsAgency(
  fileId: string,
  ranges: string[],
  opts?: { formatted?: boolean },
): Promise<Record<string, string[][]>> {
  const id = await getDesignatedReaderId();
  if (!id) throw new Error("google_not_connected");
  if (ranges.length === 0) return {};
  // Use a unit separator () so the cache key is unambiguously reversible.
  return cachedBatchValues(id, fileId, ranges.join(""), !!opts?.formatted);
}

/**
 * Build a Sheets API client authenticated as the given user. The googleapis
 * library auto-refreshes access tokens; we listen for the refresh event and
 * persist the new token so we don't keep paying the refresh roundtrip.
 */
export async function getSheetsClientForUser(
  userId: string,
): Promise<sheets_v4.Sheets> {
  const tokens = await getTokensForUser(userId);
  if (!tokens) {
    throw new Error("google_not_connected");
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date
      ? new Date(tokens.expiry_date).getTime()
      : undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type,
  });

  client.on("tokens", (refreshed: Credentials) => {
    // Persist refreshed credentials in the background. Errors here shouldn't
    // crash the request — they'll surface on the next read if truly broken.
    saveTokensForUser(userId, {
      ...refreshed,
      refresh_token: refreshed.refresh_token ?? tokens.refresh_token ?? undefined,
    }).catch((e) => {
      console.warn("[google/sheets] failed to persist refreshed token:", e);
    });
  });

  return google.sheets({ version: "v4", auth: client });
}

export type SheetTab = {
  title: string;
  rowCount: number;
  columnCount: number;
  sheetId: number;
};

/**
 * Pull lightweight metadata for a sheet: its title, timezone, and the list of
 * tabs with their dimensions. Used to confirm a connection works + show the
 * admin what tabs Cult OS sees in their Mainsheet.
 */
export async function getSheetMetadata(userId: string, fileId: string) {
  const sheets = await getSheetsClientForUser(userId);
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: fileId,
    fields: "properties(title,timeZone,locale),sheets(properties(sheetId,title,gridProperties))",
  });

  const tabs: SheetTab[] = (data.sheets ?? []).map((s) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title ?? "(untitled)",
    rowCount: s.properties?.gridProperties?.rowCount ?? 0,
    columnCount: s.properties?.gridProperties?.columnCount ?? 0,
  }));

  return {
    title: data.properties?.title ?? null,
    timeZone: data.properties?.timeZone ?? null,
    locale: data.properties?.locale ?? null,
    tabs,
  };
}

/**
 * Read a range of values from a sheet. Range follows A1 notation, e.g.
 * "Leads!A1:O500" or "'Daily Data'!A:Z".
 */
export async function getSheetValues(
  userId: string,
  fileId: string,
  range: string,
  opts?: { formatted?: boolean },
): Promise<string[][]> {
  const sheets = await getSheetsClientForUser(userId);
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: fileId,
    range,
    // FORMATTED keeps ₹/%/commas (we parse them); UNFORMATTED gives raw numbers.
    valueRenderOption: opts?.formatted ? "FORMATTED_VALUE" : "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return (data.values ?? []).map((row) =>
    (row ?? []).map((c) => String(c ?? "")),
  );
}

// Quote a tab title for use in an A1 range, escaping embedded single quotes.
function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/**
 * Read the first `rows` rows of each given tab in one batched call. Used to
 * inspect column headers (which usually sit in row 1, sometimes row 2). Returns
 * a map of tab title -> array of rows (each row an array of cell strings).
 */
export async function getTabHeaderRows(
  userId: string,
  fileId: string,
  tabTitles: string[],
  rows = 2,
): Promise<Record<string, string[][]>> {
  if (tabTitles.length === 0) return {};
  const sheets = await getSheetsClientForUser(userId);
  const ranges = tabTitles.map((t) => `${quoteTab(t)}!1:${rows}`);
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: fileId,
    ranges,
    valueRenderOption: "FORMATTED_VALUE",
    majorDimension: "ROWS",
  });

  const out: Record<string, string[][]> = {};
  (data.valueRanges ?? []).forEach((vr, i) => {
    const title = tabTitles[i];
    out[title] = (vr.values ?? []).map((row) =>
      (row ?? []).map((c) => String(c ?? "").trim()),
    );
  });
  return out;
}
