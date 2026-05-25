-- Run in Supabase SQL Editor after schema.sql / schema-continue.sql
-- Restricts site engineers, PMs, and customers to ONLY projects they are assigned to.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.user_can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (
          p.role = 'customer'
          and exists (
            select 1 from public.projects pr
            where pr.id = p_project_id and pr.customer_id = auth.uid()
          )
        )
        or (
          p.role = 'pm'
          and exists (
            select 1 from public.projects pr
            where pr.id = p_project_id and pr.pm_id = auth.uid()
          )
        )
        or (
          p.role = 'engineer'
          and exists (
            select 1 from public.project_engineers pe
            where pe.project_id = p_project_id and pe.engineer_id = auth.uid()
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
drop policy if exists "Staff can manage projects" on public.projects;
drop policy if exists "Customers can view assigned projects" on public.projects;

create policy "Admins manage all projects"
  on public.projects for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "PMs view and edit assigned projects"
  on public.projects for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'pm'
    )
    and pm_id = auth.uid()
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'pm'
    )
    and pm_id = auth.uid()
  );

create policy "PMs can create projects"
  on public.projects for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'pm'
    )
  );

create policy "Engineers view assigned projects"
  on public.projects for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'engineer'
    )
    and exists (
      select 1 from public.project_engineers pe
      where pe.project_id = id and pe.engineer_id = auth.uid()
    )
  );

create policy "Customers view assigned projects"
  on public.projects for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'customer'
    )
    and customer_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- project_engineers
-- ---------------------------------------------------------------------------
drop policy if exists "Staff manage project engineers" on public.project_engineers;
drop policy if exists "Customers can view project engineers" on public.project_engineers;

create policy "Admins manage project engineers"
  on public.project_engineers for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "PMs manage engineers on assigned projects"
  on public.project_engineers for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'pm'
    )
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.pm_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'pm'
    )
    and exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.pm_id = auth.uid()
    )
  );

create policy "Users view project engineers for accessible projects"
  on public.project_engineers for select to authenticated
  using (public.user_can_access_project(project_id));

-- ---------------------------------------------------------------------------
-- Child tables: milestones, expenses, payments, additional works, labour
-- ---------------------------------------------------------------------------
drop policy if exists "Staff manage milestones" on public.milestones;
drop policy if exists "Staff manage expenses" on public.expenses;
drop policy if exists "Staff manage client payments" on public.client_payments;
drop policy if exists "Staff manage vendor payments" on public.vendor_payments;
drop policy if exists "Staff manage additional works" on public.additional_works;
drop policy if exists "Staff manage labour entries" on public.labour_entries;

create policy "Admins manage milestones" on public.milestones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage milestones on assigned projects" on public.milestones for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  );

create policy "Engineers view milestones on assigned projects" on public.milestones for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and public.user_can_access_project(project_id)
  );

create policy "Customers view milestones on assigned projects" on public.milestones for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer')
    and public.user_can_access_project(project_id)
  );

create policy "Admins manage expenses" on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage expenses on assigned projects" on public.expenses for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  );

create policy "Engineers manage expenses on assigned projects" on public.expenses for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and public.user_can_access_project(project_id)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and public.user_can_access_project(project_id)
  );

create policy "Customers view expenses on assigned projects" on public.expenses for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer')
    and public.user_can_access_project(project_id)
  );

create policy "Admins manage client payments" on public.client_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage client payments on assigned projects" on public.client_payments for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  );

create policy "Customers view client payments on assigned projects" on public.client_payments for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer')
    and public.user_can_access_project(project_id)
  );

create policy "Admins manage vendor payments" on public.vendor_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage vendor payments on assigned projects" on public.vendor_payments for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  );

create policy "PMs and customers view vendor payments on accessible projects" on public.vendor_payments for select to authenticated
  using (public.user_can_access_project(project_id));

create policy "Admins manage additional works" on public.additional_works for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage additional works on assigned projects" on public.additional_works for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  );

create policy "Customers view additional works on assigned projects" on public.additional_works for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'customer')
    and public.user_can_access_project(project_id)
  );

create policy "Admins manage labour entries" on public.labour_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "PMs manage labour entries on assigned projects" on public.labour_entries for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pm')
    and exists (select 1 from public.projects pr where pr.id = project_id and pr.pm_id = auth.uid())
  );

create policy "Engineers manage labour entries on assigned projects" on public.labour_entries for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and public.user_can_access_project(project_id)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and public.user_can_access_project(project_id)
  );
