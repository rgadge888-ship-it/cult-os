-- Per-client mapping of canonical roles -> actual sheet tab titles.
-- Tab names vary per client (some prefix with codes like "DV", "MRW"), so a
-- regex on the title isn't reliable. This jsonb lets admins pin the exact tab
-- for each role at connect time. Shape:
--   { "leads": "Leadsheet", "daily": "FB Daily", "weekly": "...",
--     "monthly": "...", "webinar": "Webinar Data", "creative": "...",
--     "schedule": "..." }
-- Any missing key falls back to the app's auto-detect heuristics
-- (src/lib/sheets/tabs.ts).
alter table public.clients
  add column if not exists tab_map jsonb not null default '{}'::jsonb;
