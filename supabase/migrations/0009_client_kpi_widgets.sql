-- Per-client KPI widgets selected for the admin client overview.
-- The KPI values themselves still come from the client's Foundation Sheet.

create table if not exists public.client_kpi_widgets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kpi_label text not null,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_kpi_widgets_label_not_blank check (btrim(kpi_label) <> ''),
  constraint client_kpi_widgets_unique_label unique (client_id, kpi_label)
);

create index if not exists client_kpi_widgets_client_idx
  on public.client_kpi_widgets(client_id, sort_order, created_at);

drop trigger if exists trg_client_kpi_widgets_updated_at on public.client_kpi_widgets;
create trigger trg_client_kpi_widgets_updated_at before update on public.client_kpi_widgets
for each row execute function public.set_updated_at();

alter table public.client_kpi_widgets enable row level security;

drop policy if exists client_kpi_widgets_select on public.client_kpi_widgets;
create policy client_kpi_widgets_select on public.client_kpi_widgets
  for select using (public.is_assigned_admin(client_id));

drop policy if exists client_kpi_widgets_insert on public.client_kpi_widgets;
create policy client_kpi_widgets_insert on public.client_kpi_widgets
  for insert with check (public.is_assigned_admin(client_id));

drop policy if exists client_kpi_widgets_update on public.client_kpi_widgets;
create policy client_kpi_widgets_update on public.client_kpi_widgets
  for update using (public.is_assigned_admin(client_id))
  with check (public.is_assigned_admin(client_id));

drop policy if exists client_kpi_widgets_delete on public.client_kpi_widgets;
create policy client_kpi_widgets_delete on public.client_kpi_widgets
  for delete using (public.is_assigned_admin(client_id));
