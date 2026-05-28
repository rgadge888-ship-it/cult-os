-- Cult OS — per-admin Google OAuth tokens
-- Applied to project evjlmrhgxyjumbfjzbpq on 2026-05-27 via MCP.
--
-- Stores access_token + refresh_token for each admin who has connected their
-- Google account. Used by the Sheets reader to authenticate API calls.
-- RLS: users see their own row; admin role can manage. Writes happen via the
-- service-role server client (which bypasses RLS).

create table public.google_oauth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expiry_date timestamptz,
  scope text,
  token_type text not null default 'Bearer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_google_oauth_tokens_updated_at
  before update on public.google_oauth_tokens
  for each row execute function public.set_updated_at();

alter table public.google_oauth_tokens enable row level security;

create policy goauth_self_select on public.google_oauth_tokens
  for select using (user_id = auth.uid());

create policy goauth_admin_write on public.google_oauth_tokens
  for all using (public.is_admin()) with check (public.is_admin());
