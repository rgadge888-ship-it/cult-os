-- V1.5: task management (Asana-style) for the agency team.
-- Internal team workflow only — clients never see this data.

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'blocked', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_source as enum ('manual', 'from_mom');
exception when duplicate_object then null; end $$;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references auth.users(id) on delete set null,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_date date,
  source task_source not null default 'manual',
  source_report_id uuid references public.weekly_reports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_client_idx on public.tasks(client_id);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index tasks_status_idx on public.tasks(status);
create index tasks_due_date_idx on public.tasks(due_date) where due_date is not null;

create trigger trg_tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy tasks_admin_select on public.tasks for select using (public.is_admin());
create policy tasks_admin_insert on public.tasks for insert with check (public.is_admin());
create policy tasks_admin_update on public.tasks for update using (public.is_admin()) with check (public.is_admin());
create policy tasks_super_admin_delete on public.tasks for delete using (public.is_super_admin());
