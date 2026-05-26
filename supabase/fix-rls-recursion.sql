-- Run in Supabase SQL Editor if you see:
-- "infinite recursion detected in policy for relation projects"
--
-- Cause: projects ↔ project_engineers policies referenced each other through RLS.
-- Fix: security-definer helpers with row_security disabled for internal lookups.

-- ---------------------------------------------------------------------------
-- Helpers (bypass RLS — safe; still uses auth.uid())
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_pm_for_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.projects pr
    where pr.id = p_project_id and pr.pm_id = auth.uid()
  );
$$;

create or replace function public.is_engineer_for_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.project_engineers pe
    where pe.project_id = p_project_id and pe.engineer_id = auth.uid()
  );
$$;

create or replace function public.is_customer_for_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.projects pr
    where pr.id = p_project_id and pr.customer_id = auth.uid()
  );
$$;

create or replace function public.user_can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select case public.current_user_role()
    when 'admin' then true
    when 'pm' then public.is_pm_for_project(p_project_id)
    when 'engineer' then public.is_engineer_for_project(p_project_id)
    when 'customer' then public.is_customer_for_project(p_project_id)
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- projects — engineer policy must not query project_engineers under RLS
-- ---------------------------------------------------------------------------
drop policy if exists "Engineers view assigned projects" on public.projects;

create policy "Engineers view assigned projects"
  on public.projects for select to authenticated
  using (
    public.current_user_role() = 'engineer'
    and public.is_engineer_for_project(id)
  );

-- ---------------------------------------------------------------------------
-- project_engineers — no user_can_access_project (it re-entered projects RLS)
-- ---------------------------------------------------------------------------
drop policy if exists "Users view project engineers for accessible projects" on public.project_engineers;

create policy "Engineers view own project engineer rows"
  on public.project_engineers for select to authenticated
  using (
    public.current_user_role() = 'engineer'
    and engineer_id = auth.uid()
  );

create policy "Customers view project engineers on their projects"
  on public.project_engineers for select to authenticated
  using (
    public.current_user_role() = 'customer'
    and public.is_customer_for_project(project_id)
  );

create policy "PMs view project engineers on assigned projects"
  on public.project_engineers for select to authenticated
  using (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  );

drop policy if exists "PMs manage engineers on assigned projects" on public.project_engineers;

create policy "PMs manage engineers on assigned projects"
  on public.project_engineers for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  )
  with check (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  );

-- ---------------------------------------------------------------------------
-- Child tables — replace inline projects subqueries for PMs
-- ---------------------------------------------------------------------------
drop policy if exists "PMs manage milestones on assigned projects" on public.milestones;
create policy "PMs manage milestones on assigned projects" on public.milestones for all to authenticated
  using (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id))
  with check (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id));

drop policy if exists "PMs manage expenses on assigned projects" on public.expenses;
create policy "PMs manage expenses on assigned projects" on public.expenses for all to authenticated
  using (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id))
  with check (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id));

drop policy if exists "PMs manage client payments on assigned projects" on public.client_payments;
create policy "PMs manage client payments on assigned projects" on public.client_payments for all to authenticated
  using (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id))
  with check (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id));

drop policy if exists "PMs manage vendor payments on assigned projects" on public.vendor_payments;
create policy "PMs manage vendor payments on assigned projects" on public.vendor_payments for all to authenticated
  using (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id))
  with check (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id));

drop policy if exists "PMs manage additional works on assigned projects" on public.additional_works;
create policy "PMs manage additional works on assigned projects" on public.additional_works for all to authenticated
  using (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id))
  with check (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id));

drop policy if exists "PMs manage labour entries on assigned projects" on public.labour_entries;
create policy "PMs manage labour entries on assigned projects" on public.labour_entries for all to authenticated
  using (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id))
  with check (public.current_user_role() = 'pm' and public.is_pm_for_project(project_id));
