-- Cult OS V1 — sheets-source schema
-- Created 2026-05-26 (replaces earlier draft that assumed webhook-first)
--
-- Design summary:
--   Source of truth for ad/lead/webinar data is each client's Google Drive Mainsheet
--   (6 tabs: Schedule, Leads, Daily Data, Webinar Analysis, Creative Tracker, Notes).
--   Cult OS reads sheets via Google Sheets API. This DB stores only:
--     - users (admin + client logins)
--     - clients (linked to their Mainsheet by Drive file ID)
--     - deliverables (the checklist clients see)
--     - weekly_reports (generated + stored)
--     - lead_annotations (tags/notes admins add on top of leads in the sheet)
--     - sheet_column_mappings (for fuzzy-matching column names that vary per client)
--     - activity_log (audit trail)
--
-- How to apply:
--   Supabase dashboard → SQL Editor → New query → paste this entire file → Run.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- Enums
-- ============================================================================
do $$ begin
  create type app_role as enum ('super_admin', 'admin', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_plan as enum ('one_month', 'three_month');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_status as enum ('onboarding', 'active', 'paused', 'churned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deliverable_status as enum ('not_started', 'in_progress', 'done', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Tables
-- ============================================================================

-- profiles: one row per auth.users user. Role + which client they belong to.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role app_role not null default 'client',
  client_id uuid,  -- FK added after clients table is created
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- clients: the coaching businesses Cult Marketers serves.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  niche text,
  plan client_plan not null default 'three_month',
  status client_status not null default 'onboarding',
  start_date date,
  end_date date,
  monthly_ad_budget_inr numeric(12, 2),
  timezone text not null default 'Asia/Kolkata',  -- for scheduling report windows correctly
  -- Mainsheet integration
  mainsheet_file_id text,           -- Google Drive file ID of the client's Mainsheet
  mainsheet_url text,                -- The full URL (for display + copying)
  sheets_connected_at timestamptz,   -- When admin first linked the Mainsheet
  -- Misc
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete set null;

create index profiles_client_id_idx on public.profiles(client_id);
create index profiles_role_idx on public.profiles(role);
create index clients_mainsheet_file_id_idx on public.clients(mainsheet_file_id);

-- deliverables: checklist per client. Pre-seeded from the offer bullet list.
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  category text,
  status deliverable_status not null default 'not_started',
  notes text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deliverables_client_id_idx on public.deliverables(client_id);

-- weekly_reports: generated reports. Combines sheet data (snapshot) + editable text.
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,

  -- Report window (computed from client schedule + batch-shift logic)
  week_start_date date not null,
  week_end_date date not null,

  -- Snapshot of metrics at the moment of generation (read from sheets).
  -- Shape: { fb: {...}, yt: {...}, funnel: {...}, top_creatives: [...] }
  data jsonb not null default '{}'::jsonb,

  -- Editable text sections
  narrative text,        -- AI-drafted in V2, manual in V1
  discussion text,       -- "Points to be Discussed"
  mom text,              -- Minutes of Meeting

  status report_status not null default 'draft',
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weekly_reports_client_idx on public.weekly_reports(client_id, week_start_date desc);
create unique index weekly_reports_unique_per_week on public.weekly_reports(client_id, week_start_date);

-- lead_annotations: tags/notes admins attach to leads (which live in the Mainsheet).
-- We don't duplicate the lead itself; we reference it by the sheet row identifier.
create table public.lead_annotations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- Identify the lead. Email is the most stable cross-row identifier from Pabbly.
  lead_email text,
  lead_phone text,
  webinar_tag text,           -- joins to Mainsheet's Schedule + Webinar Analysis tabs
  -- Annotation content
  tag text,                   -- e.g. 'hot', 'qualified', 'spam', 'follow_up'
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_annotations_client_idx on public.lead_annotations(client_id);
create index lead_annotations_email_idx on public.lead_annotations(client_id, lead_email);

-- sheet_column_mappings: stores how a given client's column names map to canonical fields.
-- Humans rename columns; this lets us remember "Carrie's 'Amount Spent' = canonical 'spend'".
create table public.sheet_column_mappings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tab_name text not null,           -- 'Schedule' | 'Leads' | 'Daily Data' | 'Webinar Analysis' | 'Creative Tracker'
  sheet_column_name text not null,  -- the actual header text in this client's sheet
  canonical_field text not null,    -- the internal field name we map to
  confidence numeric(3, 2),         -- 0.00-1.00 — how sure we are; <0.8 surfaces for manual confirm
  mapped_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index sheet_column_mappings_unique
  on public.sheet_column_mappings(client_id, tab_name, sheet_column_name);

-- activity_log: audit trail. "We delivered X on date Y" — proof for clients.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,           -- 'deliverable.completed', 'report.published', 'lead.tagged', etc.
  subject_table text,
  subject_id uuid,
  metadata jsonb,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);
create index activity_log_client_idx on public.activity_log(client_id, created_at desc);

-- ============================================================================
-- Helper functions used by RLS
-- ============================================================================

-- Returns true if the current authenticated user has role = 'super_admin'.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- Returns true if the current authenticated user has role = 'admin' OR 'super_admin'.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

-- Returns the client_id of the current authenticated user (null for admins/super_admins).
create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at         before update on public.profiles         for each row execute function public.set_updated_at();
create trigger trg_clients_updated_at          before update on public.clients          for each row execute function public.set_updated_at();
create trigger trg_deliverables_updated_at     before update on public.deliverables     for each row execute function public.set_updated_at();
create trigger trg_weekly_reports_updated_at   before update on public.weekly_reports   for each row execute function public.set_updated_at();
create trigger trg_lead_annotations_updated_at before update on public.lead_annotations for each row execute function public.set_updated_at();

-- On auth.users signup, auto-create a profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles              enable row level security;
alter table public.clients               enable row level security;
alter table public.deliverables          enable row level security;
alter table public.weekly_reports        enable row level security;
alter table public.lead_annotations      enable row level security;
alter table public.sheet_column_mappings enable row level security;
alter table public.activity_log          enable row level security;

-- profiles: users read their own row; admins read all; only super_admin manages roles.
create policy profiles_self_select        on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update        on public.profiles for update using (id = auth.uid() or public.is_super_admin());
create policy profiles_super_admin_insert on public.profiles for insert with check (public.is_super_admin());
create policy profiles_super_admin_delete on public.profiles for delete using (public.is_super_admin());

-- clients: client users see only their own; admins see all; only admins write.
create policy clients_member_select       on public.clients for select using (id = public.current_client_id() or public.is_admin());
create policy clients_admin_write         on public.clients for all    using (public.is_admin()) with check (public.is_admin());

-- deliverables: clients see their own (read-only); admins manage all.
create policy deliverables_member_select  on public.deliverables for select using (client_id = public.current_client_id() or public.is_admin());
create policy deliverables_admin_write    on public.deliverables for all    using (public.is_admin()) with check (public.is_admin());

-- weekly_reports: client sees only published reports for their client; admins see all + can edit.
create policy weekly_reports_member_select on public.weekly_reports for select using (
  (client_id = public.current_client_id() and status = 'published')
  or public.is_admin()
);
create policy weekly_reports_admin_write   on public.weekly_reports for all using (public.is_admin()) with check (public.is_admin());

-- lead_annotations: clients don't see admin notes; admins manage.
create policy lead_annotations_admin_all  on public.lead_annotations for all using (public.is_admin()) with check (public.is_admin());

-- sheet_column_mappings: admin-only.
create policy sheet_column_mappings_admin on public.sheet_column_mappings for all using (public.is_admin()) with check (public.is_admin());

-- activity_log: clients see only client_visible entries for their client; admins see everything.
create policy activity_log_member_select  on public.activity_log for select using (
  (client_visible and client_id = public.current_client_id())
  or public.is_admin()
);
create policy activity_log_admin_write    on public.activity_log for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Seed: standard deliverables template (from Cult Marketers offer mind map)
-- Admins call this after creating a client to populate the checklist.
-- ============================================================================
create or replace function public.seed_default_deliverables(p_client_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can seed deliverables';
  end if;

  insert into public.deliverables (client_id, name, category, sort_order) values
    (p_client_id, 'Consulting',                                       'Strategy',  10),
    (p_client_id, 'Positioning',                                      'Strategy',  20),
    (p_client_id, 'L0 Offer Building',                                'Strategy',  30),
    (p_client_id, 'Building Power Offers',                            'Strategy',  40),
    (p_client_id, 'Landing Page Copywriting',                         'Funnel',    50),
    (p_client_id, 'Landing Page Designing',                           'Funnel',    60),
    (p_client_id, 'Landing Page Hosting',                             'Funnel',    70),
    (p_client_id, 'PPT Building',                                     'Funnel',    80),
    (p_client_id, 'Pre-Nurturing Sequence',                           'Funnel',    90),
    (p_client_id, 'Post-Nurturing Sequence',                          'Funnel',   100),
    (p_client_id, 'Copywriting',                                      'Funnel',   110),
    (p_client_id, 'Youtube & Facebook Ads',                           'Ads',      120),
    (p_client_id, 'Video AD Editing',                                 'Ads',      130),
    (p_client_id, 'IMG AD Designing',                                 'Ads',      140),
    (p_client_id, 'Training on Webinar / Workshop / Masterclass Sales','Training', 150),
    (p_client_id, 'AI Build',                                         'Tech',     160),
    (p_client_id, 'White Label Tool Access',                          'Tech',     170),
    (p_client_id, 'Automation Tool (Pabbly/Zapier)',                  'Tech',     180),
    (p_client_id, 'Cult OS Access',                                   'Tech',     190),
    (p_client_id, 'Weekly Calls',                                     'Support',  200),
    (p_client_id, 'Technical Support',                                'Support',  210);
end;
$$;
