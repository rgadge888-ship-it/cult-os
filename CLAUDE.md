# Cult OS — Project Conventions

> Auto-loaded by Claude Code in this directory. Keep tight — every line is paid for on every turn.

## What this is

Internal webapp for **Cult Marketers** (Rahul's performance marketing agency for coaches). Replaces a Google-Sheets-based reporting workflow with a real product. Clients pay for "Cult OS Access" as part of their package — it's customer-facing, not just internal.

## Tech stack (don't rederive)

- **Next.js 15** App Router, TypeScript, Tailwind v4
- **Supabase** (Postgres + Auth + RLS) — project ID `evjlmrhgxyjumbfjzbpq`
- **Google Sheets API** (read-only OAuth, per-admin tokens) — reads each client's Mainsheet directly
- shadcn-style primitives in `src/components/ui/`
- Dev: `npm run dev` (port 3000)
- Typecheck: `npx tsc --noEmit`

## Architecture

- **Source of truth for ad/lead/webinar data = each client's Google Sheets Mainsheet.** Cult OS reads, doesn't duplicate. See `~/.claude/projects/-Users-rahul07-Desktop-VS/memory/reference_client_mainsheet_structure.md`.
- **Cult OS DB stores only what isn't in sheets**: users, clients, deliverables, weekly_reports, lead_annotations, sheet_column_mappings, activity_log, google_oauth_tokens.
- **Three roles**: `super_admin` (Rahul), `admin` (team), `client` (coaches). RLS enforces isolation at the database level — see `supabase/migrations/0001_init.sql`.
- **Weekly reports** read directly from the `Weekly Datasheet - FB` tab (Option A — pre-aggregated rows; latest = this week, previous = last week). Batch-shift date windowing is inherited from how Rahul fills the sheet.

## Directory layout

```
src/
  app/
    (admin)/admin/        # super_admin + admin routes
      clients/[clientId]/reports/  # generate, view, edit, publish weekly reports
    (client)/client/      # client (coach) portal
    api/auth/google/      # OAuth connect / callback / disconnect
    login/                # email+password login
  components/
    ui/                   # Panel, SectionHeader, StatusPill, etc.
    reports/              # WeeklyReportView, ReportNarrative
  lib/
    auth/                 # requireUser, getCurrentUser
    google/               # OAuth, Sheets API, status
    reports/              # parse (matcher), build-weekly
    supabase/             # browser, server, admin clients
    db/types.ts           # Domain types — keep in sync with schema
```

## Visual style (don't drift)

- Pure black bg (`bg-black`), zinc neutrals, **single accent: orange-500**
- Monospace for numbers, IDs, timestamps; sans for prose
- Terminal-style section headers: `[ section ]`
- Status pills with colored dots (`StatusPill` component)
- Sharp borders (`border-zinc-800/900`), generous panels
- Never use emojis unless explicitly requested

## Conventions

- **RLS everywhere**: query via the server Supabase client; bypass with service-role only in admin server actions when there's no alternative.
- **Server actions** for mutations (no API routes for form posts); plain server components for reads.
- **`requireUser({ adminOnly | clientOnly | superAdminOnly })`** at the top of every gated page/action.
- **Fuzzy column matching** for sheet columns (`lib/reports/parse.ts`) — humans rename columns; the matcher handles it.
- **Mutate via `revalidatePath`** after server actions that change shown data.
- **No new dependencies** without checking — slim shadcn + lucide + googleapis + supabase set.
- **Migrations in `supabase/migrations/`** — apply remotely via the Supabase MCP `apply_migration` tool, keep the local file in sync.

## How Claude should communicate here (terseness rules — strict)

1. **No narration of intent.** Skip "Let me / I'll / Going to / Building now."
2. **No recap of completed work** unless verification revealed something the user needs to know.
3. **End-of-turn summaries: 1–2 sentences max.**
4. **One short status line per major step**, not paragraph blocks.
5. **No hedging.** State the recommendation directly.
6. **Code over prose.** Lead with diffs/files; explain only the non-obvious.
7. **Skip celebratory framing** — "working" / "great" / "milestone" — drop.
8. **No restating the user's message.** Address it; don't echo it.
9. **Markdown links to files**, never backtick paths for code references.

## V1 scope (locked)

**Admin nav:**
1. Dashboard — cross-client overview, red alerts, recent MOMs, activity
2. Clients — list + per-client deep view (reports, deliverables, login mgmt, mainsheet preview)
3. Settings — Google connection, account

**Client nav (5):**
1. Dashboard — revenue / ROAS / leads / CPP cards with date range filter
2. Leads — Leadsheet rows, filterable
3. Webinar Reports — per-event funnel from Webinar Data tab
4. Funnel Calculator — interactive what-if simulator (editable inputs, live computation)
5. Ads & Creatives — Creative Tracking Sheet with Hook/Hold rates

Weekly report generator: reads Weekly Datasheet, supports edit + publish, client-visible when published.

## Out of V1 (don't build unless asked)

- Meta Ads API / Pabbly direct / Zoom API integrations (V2)
- AI-generated narrative (V2 — Claude API)
- Task management / Asana-style (V1.5)
- Email-based client invites (V2 — manual temp password share for now)
- Customizable widget dashboards (V2)
- Reports archive UI (V1 shows latest only)

## Common pitfalls

- `middleware.ts` convention in Next 16 is deprecated → rename to `proxy.ts` eventually.
- Tab names in client Mainsheets vary (`Leadsheet` vs `Leads`, `Webinar Data` vs `Webinar Analysis`, `Daily Datasheet - FB`). Always fuzzy-match via `lib/reports/parse.ts`.
- Google OAuth in *Testing* mode — only allowlisted test users can sign in.
- Service-role key bypasses RLS — only in `createAdminClient()` server-side.
