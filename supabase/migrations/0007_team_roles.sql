-- Add the three functional team roles + role helper functions.
-- Applied to project pxevdslzzyjjyrxkwaej via MCP.
-- Role matrix lives in memory:reference-cultos-roles and
-- src/lib/auth/permissions.ts. 'admin' enum value kept for back-compat.

alter type app_role add value if not exists 'strategist';
alter type app_role add value if not exists 'automation';
alter type app_role add value if not exists 'copywriter';

-- "Any team member" — replaces the old admin-only meaning of is_admin.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin','strategist','automation','copywriter','admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff();
$$;

-- Roles that see every client (no per-client assignment needed).
create or replace function public.sees_all_clients()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin','strategist')
  );
$$;

create or replace function public.can_manage_clients()
returns boolean language sql stable security definer set search_path = public as $$
  select public.sees_all_clients();
$$;

create or replace function public.is_assigned_admin(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.sees_all_clients()
    or exists (
      select 1 from public.client_admins ca
      where ca.client_id = cid and ca.admin_id = auth.uid()
    );
$$;

-- Tighten client insert to super_admin + strategist.
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert with check (public.can_manage_clients());
