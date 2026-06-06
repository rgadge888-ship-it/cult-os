-- Team management: admins (team members) see only the clients assigned to them.
-- Super_admin sees everything + manages assignments. Single admin role for now.
-- Applied to project pxevdslzzyjjyrxkwaej via MCP.

create table if not exists public.client_admins (
  client_id uuid not null references public.clients(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id) on delete set null,
  primary key (client_id, admin_id)
);
create index if not exists client_admins_admin_idx on public.client_admins(admin_id);

alter table public.client_admins enable row level security;

create or replace function public.is_assigned_admin(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.client_admins ca
      where ca.client_id = cid and ca.admin_id = auth.uid()
    );
$$;

create policy client_admins_self_select on public.client_admins
  for select using (admin_id = auth.uid() or public.is_super_admin());
create policy client_admins_super_manage on public.client_admins
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- clients
drop policy if exists clients_member_select on public.clients;
drop policy if exists clients_admin_write on public.clients;
create policy clients_select on public.clients
  for select using (id = public.current_client_id() or public.is_assigned_admin(id));
create policy clients_insert on public.clients
  for insert with check (public.is_admin());
create policy clients_update on public.clients
  for update using (public.is_assigned_admin(id)) with check (public.is_assigned_admin(id));
create policy clients_delete on public.clients
  for delete using (public.is_super_admin());

-- deliverables
drop policy if exists deliverables_member_select on public.deliverables;
drop policy if exists deliverables_admin_write on public.deliverables;
create policy deliverables_select on public.deliverables
  for select using (client_id = public.current_client_id() or public.is_assigned_admin(client_id));
create policy deliverables_write on public.deliverables
  for all using (public.is_assigned_admin(client_id)) with check (public.is_assigned_admin(client_id));

-- weekly_reports
drop policy if exists weekly_reports_member_select on public.weekly_reports;
drop policy if exists weekly_reports_admin_write on public.weekly_reports;
create policy weekly_reports_select on public.weekly_reports
  for select using (
    (client_id = public.current_client_id() and status = 'published')
    or public.is_assigned_admin(client_id)
  );
create policy weekly_reports_write on public.weekly_reports
  for all using (public.is_assigned_admin(client_id)) with check (public.is_assigned_admin(client_id));

-- lead_annotations
drop policy if exists lead_annotations_admin_all on public.lead_annotations;
create policy lead_annotations_write on public.lead_annotations
  for all using (public.is_assigned_admin(client_id)) with check (public.is_assigned_admin(client_id));

-- sheet_column_mappings
drop policy if exists sheet_column_mappings_admin on public.sheet_column_mappings;
create policy sheet_column_mappings_write on public.sheet_column_mappings
  for all using (public.is_assigned_admin(client_id)) with check (public.is_assigned_admin(client_id));

-- activity_log
drop policy if exists activity_log_member_select on public.activity_log;
drop policy if exists activity_log_admin_write on public.activity_log;
create policy activity_log_select on public.activity_log
  for select using (
    (client_visible and client_id = public.current_client_id())
    or public.is_assigned_admin(client_id)
  );
create policy activity_log_write on public.activity_log
  for all using (public.is_assigned_admin(client_id)) with check (public.is_assigned_admin(client_id));

-- tasks
drop policy if exists tasks_admin_select on public.tasks;
drop policy if exists tasks_admin_insert on public.tasks;
drop policy if exists tasks_admin_update on public.tasks;
drop policy if exists tasks_super_admin_delete on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    public.is_super_admin()
    or assignee_id = auth.uid()
    or created_by = auth.uid()
    or public.is_assigned_admin(client_id)
  );
create policy tasks_insert on public.tasks
  for insert with check (public.is_admin());
create policy tasks_update on public.tasks
  for update using (
    public.is_super_admin()
    or assignee_id = auth.uid()
    or created_by = auth.uid()
    or public.is_assigned_admin(client_id)
  ) with check (public.is_admin());
create policy tasks_delete on public.tasks
  for delete using (public.is_super_admin());
