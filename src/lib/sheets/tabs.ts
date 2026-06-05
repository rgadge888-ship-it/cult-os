// Canonical tab roles Cult OS reads from a client's Mainsheet.
// Tab titles vary per client (e.g. "DV Leads", "MRW Daily FB"), so we let
// admins pin the exact tab per role (stored on clients.tab_map). When a role
// isn't pinned we fall back to regex auto-detection against the live titles.

export type TabRole =
  | "leads"
  | "daily"
  | "weekly"
  | "monthly"
  | "webinar"
  | "creative"
  | "schedule";

export type TabMap = Partial<Record<TabRole, string>>;

export const TAB_ROLES: { role: TabRole; label: string; hint: string }[] = [
  { role: "leads", label: "Leads", hint: "registrations / lead capture (Pabbly)" },
  { role: "daily", label: "Daily Data", hint: "one row per day · spend + KPIs" },
  { role: "weekly", label: "Weekly Data", hint: "one row per week (date range)" },
  { role: "monthly", label: "Monthly Data", hint: "one row per month" },
  { role: "webinar", label: "Webinar Data", hint: "per-webinar analysis" },
  { role: "creative", label: "Creative Tracker", hint: "per-creative ad performance" },
  { role: "schedule", label: "Schedule", hint: "workshop dates / tags" },
];

// Auto-detect fallbacks. Order matters — more specific patterns first.
const AUTO_PATTERNS: Record<TabRole, RegExp[]> = {
  // weekly/monthly must be checked before daily, since "daily" alone is generic
  weekly: [/weekly/i],
  monthly: [/monthly/i],
  daily: [/daily/i],
  leads: [/leadsheet/i, /\blead\b/i, /registration/i, /\bregs?\b/i, /sign[\s-]?up/i],
  webinar: [/webinar/i, /workshop analysis/i],
  creative: [/creative/i, /\bad\s*tracker/i],
  schedule: [/schedule/i, /internal sheet/i, /workshop schedule/i],
};

// Resolve a role to an actual tab title given the pinned map + available titles.
// Returns null if neither a valid pin nor an auto-match is found.
export function resolveTabTitle(
  role: TabRole,
  tabMap: TabMap | null | undefined,
  availableTitles: string[],
): string | null {
  // 1. Pinned, and the pinned tab still exists.
  const pinned = tabMap?.[role];
  if (pinned && availableTitles.includes(pinned)) return pinned;

  // 2. Auto-detect: first title matching any pattern for this role.
  for (const re of AUTO_PATTERNS[role]) {
    const hit = availableTitles.find((t) => re.test(t));
    if (hit) return hit;
  }
  return null;
}

// Best-guess auto-match used to pre-fill the mapping UI dropdowns.
export function autoGuess(role: TabRole, availableTitles: string[]): string | null {
  for (const re of AUTO_PATTERNS[role]) {
    const hit = availableTitles.find((t) => re.test(t));
    if (hit) return hit;
  }
  return null;
}
