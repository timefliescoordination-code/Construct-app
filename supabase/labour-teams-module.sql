-- Labour teams: project-scoped teams for labour expense attribution
-- Run in Supabase SQL editor after assignment-scoped-access.sql

create table if not exists public.labour_teams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists labour_teams_project_name_idx
  on public.labour_teams (project_id, name);

drop trigger if exists labour_teams_updated_at on public.labour_teams;
create trigger labour_teams_updated_at
  before update on public.labour_teams
  for each row execute function public.set_updated_at();

alter table public.expenses
  add column if not exists labour_team_id uuid references public.labour_teams (id) on delete set null;

create index if not exists expenses_labour_team_id_idx
  on public.expenses (labour_team_id)
  where labour_team_id is not null;

alter table public.labour_teams enable row level security;

drop policy if exists "Admins manage labour teams" on public.labour_teams;
create policy "Admins manage labour teams"
  on public.labour_teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "PMs manage labour teams on assigned projects" on public.labour_teams;
create policy "PMs manage labour teams on assigned projects"
  on public.labour_teams for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  )
  with check (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  );

drop policy if exists "Users view labour teams on accessible projects" on public.labour_teams;
create policy "Users view labour teams on accessible projects"
  on public.labour_teams for select to authenticated
  using (public.user_can_access_project(project_id));
