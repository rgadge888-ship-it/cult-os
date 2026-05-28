// Extract a Google Sheets file ID from any of the URL shapes Google produces:
//   https://docs.google.com/spreadsheets/d/<FILE_ID>/edit?...
//   https://docs.google.com/spreadsheets/d/<FILE_ID>/
//   https://drive.google.com/file/d/<FILE_ID>/view
//   <FILE_ID>  (raw paste)
// Returns null if nothing recognisable is found.
export function extractSheetsFileId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Match /d/<id> in any Drive/Docs URL.
  const m = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];

  // Match a raw file-id-looking string (Drive IDs are typically 30+ alphanum/dash/underscore).
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

// Make a kebab-case slug from a name.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
