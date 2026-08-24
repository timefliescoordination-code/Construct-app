-- Company-wide template list for construction stages.
-- Project milestone rows stay as snapshots; catalog edits only affect new projects.

create table if not exists public.milestone_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  expected_cost_percent numeric(5, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists milestone_templates_name_idx
  on public.milestone_templates (lower(name));

drop trigger if exists milestone_templates_updated_at on public.milestone_templates;
create trigger milestone_templates_updated_at
  before update on public.milestone_templates
  for each row execute function public.set_updated_at();

alter table public.milestone_templates enable row level security;

drop policy if exists "Admins manage milestone templates" on public.milestone_templates;
create policy "Admins manage milestone templates"
  on public.milestone_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Staff read milestone templates" on public.milestone_templates;
create policy "Staff read milestone templates"
  on public.milestone_templates for select to authenticated
  using (true);

insert into public.milestone_templates (name, expected_cost_percent, sort_order)
select v.name, v.expected_cost_percent, v.sort_order
from (
  values
    ('Foundation', 15::numeric, 1),
    ('Plinth', 10::numeric, 2),
    ('Superstructure', 25::numeric, 3),
    ('Brickwork', 12::numeric, 4),
    ('Plastering', 10::numeric, 5),
    ('Electrical & Plumbing', 12::numeric, 6),
    ('Flooring & Tiling', 8::numeric, 7),
    ('Finishing', 8::numeric, 8)
) as v(name, expected_cost_percent, sort_order)
where not exists (select 1 from public.milestone_templates);

notify pgrst, 'reload schema';
