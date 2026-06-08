-- Explicit task categorization for team workflow.
-- task_type is the product-level category:
--   weekly     = Monday/team discussion tasks
--   client_mom = client call / MOM tasks
-- source remains the origin/audit field (manual vs from_mom).

do $$ begin
  create type task_type as enum ('weekly', 'client_mom');
exception when duplicate_object then null; end $$;

alter table public.tasks
  add column if not exists task_type task_type not null default 'weekly';

update public.tasks
set task_type = case
  when source = 'from_mom' then 'client_mom'::task_type
  else 'weekly'::task_type
end
where task_type is null or task_type = 'weekly';

create index if not exists tasks_task_type_idx on public.tasks(task_type);
