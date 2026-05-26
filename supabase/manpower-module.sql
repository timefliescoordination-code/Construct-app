-- Manpower module: project-scoped labour types, weekly grids linked to milestones
-- Run in Supabase SQL editor after assignment-scoped-access.sql

alter table public.labour_types
  add column if not exists project_id uuid references public.projects (id) on delete cascade,
  add column if not exists short_label text,
  add column if not exists sort_order integer not null default 0;

alter table public.labour_types drop constraint if exists labour_types_name_key;

create unique index if not exists labour_types_project_name_idx
  on public.labour_types (project_id, name)
  where project_id is not null;

create table if not exists public.manpower_weeks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid not null references public.milestones (id) on delete restrict,
  week_number integer not null,
  start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, week_number)
);

drop trigger if exists manpower_weeks_updated_at on public.manpower_weeks;
create trigger manpower_weeks_updated_at
  before update on public.manpower_weeks
  for each row execute function public.set_updated_at();

create table if not exists public.manpower_week_rates (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.manpower_weeks (id) on delete cascade,
  labour_type_id uuid not null references public.labour_types (id) on delete cascade,
  daily_rate numeric(14, 2) not null default 0,
  unique (week_id, labour_type_id)
);

alter table public.manpower_weeks enable row level security;
alter table public.manpower_week_rates enable row level security;

-- labour_types (project-scoped)
drop policy if exists "Staff manage labour types" on public.labour_types;
drop policy if exists "Authenticated read labour types" on public.labour_types;

create policy "Admins manage labour types"
  on public.labour_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage labour types on assigned projects"
  on public.labour_types for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and project_id is not null
    and public.is_pm_for_project(project_id)
  )
  with check (
    public.current_user_role() = 'pm'
    and project_id is not null
    and public.is_pm_for_project(project_id)
  );

create policy "Engineers manage labour types on assigned projects"
  on public.labour_types for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and project_id is not null
    and public.user_can_access_project(project_id)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and project_id is not null
    and public.user_can_access_project(project_id)
  );

create policy "Users view labour types on accessible projects"
  on public.labour_types for select to authenticated
  using (
    project_id is null
    or public.user_can_access_project(project_id)
  );

-- manpower_weeks
create policy "Admins manage manpower weeks"
  on public.manpower_weeks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage manpower weeks on assigned projects"
  on public.manpower_weeks for all to authenticated
  using (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id))
  with check (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id));

create policy "Engineers manage manpower weeks on assigned projects"
  on public.manpower_weeks for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and public.user_can_access_project(project_id)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and public.user_can_access_project(project_id)
  );

create policy "Users view manpower weeks on accessible projects"
  on public.manpower_weeks for select to authenticated
  using (public.user_can_access_project(project_id));

-- manpower_week_rates (inherit access via week)
create policy "Admins manage manpower week rates"
  on public.manpower_week_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage manpower week rates on assigned projects"
  on public.manpower_week_rates for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.manpower_weeks w
      where w.id = week_id and public.is_pm_for_project(w.project_id)
    )
  )
  with check (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.manpower_weeks w
      where w.id = week_id and public.is_pm_for_project(w.project_id)
    )
  );

create policy "Engineers manage manpower week rates on assigned projects"
  on public.manpower_week_rates for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and exists (
      select 1 from public.manpower_weeks w
      where w.id = week_id and public.user_can_access_project(w.project_id)
    )
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and exists (
      select 1 from public.manpower_weeks w
      where w.id = week_id and public.user_can_access_project(w.project_id)
    )
  );

create policy "Users view manpower week rates on accessible projects"
  on public.manpower_week_rates for select to authenticated
  using (
    exists (
      select 1 from public.manpower_weeks w
      where w.id = week_id and public.user_can_access_project(w.project_id)
    )
  );

-- Customers can view labour entries
create policy "Customers view labour entries on assigned projects"
  on public.labour_entries for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer')
    and public.user_can_access_project(project_id)
  );
