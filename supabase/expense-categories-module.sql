-- Project-scoped expense categories and subcategories
-- Run in Supabase SQL editor after assignment-scoped-access.sql

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  uses_labour_teams boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_categories_project_name_idx
  on public.expense_categories (project_id, name);

drop trigger if exists expense_categories_updated_at on public.expense_categories;
create trigger expense_categories_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();

create table if not exists public.expense_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_subcategories_category_name_idx
  on public.expense_subcategories (category_id, name);

drop trigger if exists expense_subcategories_updated_at on public.expense_subcategories;
create trigger expense_subcategories_updated_at
  before update on public.expense_subcategories
  for each row execute function public.set_updated_at();

alter table public.expense_categories enable row level security;
alter table public.expense_subcategories enable row level security;

drop policy if exists "Admins manage expense categories" on public.expense_categories;
create policy "Admins manage expense categories"
  on public.expense_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "PMs manage expense categories on assigned projects" on public.expense_categories;
create policy "PMs manage expense categories on assigned projects"
  on public.expense_categories for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  )
  with check (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  );

drop policy if exists "Users view expense categories on accessible projects" on public.expense_categories;
create policy "Users view expense categories on accessible projects"
  on public.expense_categories for select to authenticated
  using (public.user_can_access_project(project_id));

drop policy if exists "Admins manage expense subcategories" on public.expense_subcategories;
create policy "Admins manage expense subcategories"
  on public.expense_subcategories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "PMs manage expense subcategories on assigned projects" on public.expense_subcategories;
create policy "PMs manage expense subcategories on assigned projects"
  on public.expense_subcategories for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.expense_categories c
      where c.id = category_id and public.is_pm_for_project(c.project_id)
    )
  )
  with check (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.expense_categories c
      where c.id = category_id and public.is_pm_for_project(c.project_id)
    )
  );

drop policy if exists "Users view expense subcategories on accessible projects" on public.expense_subcategories;
create policy "Users view expense subcategories on accessible projects"
  on public.expense_subcategories for select to authenticated
  using (
    exists (
      select 1 from public.expense_categories c
      where c.id = category_id and public.user_can_access_project(c.project_id)
    )
  );
