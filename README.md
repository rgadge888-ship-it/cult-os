# Cult OS

Internal operating system for **Cult Marketers** — performance marketing agency for coaches.

Client portal + admin dashboard. Reads each client's Google Drive Mainsheet, generates weekly reports, tracks deliverables, gives coaches a window into their own ad/funnel performance.

> See [`MINDMAP.md`](./MINDMAP.md) for the full feature outline.

---

## V1 tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui patterns |
| Database + Auth | Supabase (Postgres + Auth + RLS) |
| Sheets/Drive | googleapis (read-only OAuth) |
| Forms | react-hook-form + zod |
| Icons | lucide-react |
| Hosting | Vercel |

---

## First-time setup

### 1. Supabase — ~10 min, free, no card needed

1. **supabase.com** → sign up (use Google login). Click **New project**.
2. Name it `cult-os`. Region: **Mumbai (ap-south-1)**. Save the DB password somewhere safe.
3. Wait ~2 min for it to provision.
4. **Settings → API.** You need three values from this page:
   - **Project URL** (`https://abcd.supabase.co`)
   - **anon / public key** (long `eyJ...` string)
   - **service_role key** (another long `eyJ...` string — keep secret)
5. Paste these into `.env.local` (see step 3 below).
6. **SQL Editor → New query** → paste the entire contents of [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) → Run. All tables, helper functions, and RLS policies are created.

### 2. Google Cloud OAuth — ~15 min, free, no card needed

This lets the deployed app read your client Mainsheets. Read-only access only — Cult OS cannot modify your sheets.

1. **console.cloud.google.com** → sign in as `rgadge888@gmail.com`.
2. Top bar → "Select a project" → **New project** → name `cult-os`. Create.
3. **APIs & Services → Library** → search `Google Sheets API` → **Enable**.
4. Back to Library → search `Google Drive API` → **Enable**.
5. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create
   - App name: `Cult OS`, support email: your email
   - Scopes: add `https://www.googleapis.com/auth/spreadsheets.readonly` (read-only sheets)
   - Test users: add `rgadge888@gmail.com` (and any teammate emails you'll log in with)
6. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `cult-os-local`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Create. Copy the **Client ID** and **Client Secret** into `.env.local`.

(I'll walk you through these screens when we get there — just follow the path. If Google asks for billing info, skip it — we don't need any paid services.)

### 3. Add your keys to the app

```bash
cd ~/Desktop/cult-os
cp .env.local.example .env.local
```

Open `.env.local` and paste in the values you copied from Supabase + Google Cloud.

`.env.local` is gitignored — never commit it.

### 4. Run the app

```bash
npm run dev
```

Open **http://localhost:3000**.

---

## How the project is organised

```
cult-os/
├── src/
│   ├── app/
│   │   ├── page.tsx              # public landing
│   │   ├── login/                # email + password auth
│   │   ├── (client)/             # client portal — RLS-scoped to their own data
│   │   ├── (admin)/              # admin — sees everything
│   │   └── api/
│   │       └── auth/google/      # OAuth callback for Sheets access
│   ├── lib/
│   │   ├── supabase/             # browser + server + middleware + admin clients
│   │   ├── db/types.ts           # TypeScript mirrors of the DB schema
│   │   └── sheets/               # Google Sheets reader (added during build)
│   └── middleware.ts
├── supabase/
│   └── migrations/
│       └── 0001_init.sql         # the V1 schema (paste into Supabase SQL editor)
├── MINDMAP.md                    # full feature outline
├── .env.local.example            # template — copy to .env.local
└── README.md
```

---

## V1 status

- ✅ Next.js + TypeScript + Tailwind scaffolded
- ✅ Supabase clients (browser, server, middleware, admin)
- ✅ V1 SQL schema written (sheets-source model)
- ✅ googleapis + google-auth-library installed
- 🚧 Email + password auth flow (next)
- 🚧 Google OAuth callback to grant Sheets access (next)
- 🚧 Admin: create client + paste Mainsheet URL (next)
- 🚧 Sheets reader with fuzzy column matching (next)
- 🚧 Weekly report generator (next)
- 🚧 Client portal pages (next)

---

## Roadmap

See [`MINDMAP.md`](./MINDMAP.md) for the full V1 / V1.5 / V2 breakdown.
