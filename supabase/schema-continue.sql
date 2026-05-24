-- Run this if schema.sql failed with: relation "profiles" already exists
-- (You already created profiles — this adds the rest of the app tables.)

create extension if not exists "pgcrypto";

-- Profiles: table already exists — only refresh functions/triggers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Projects & related tables
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text not null default '',
  site_address text not null default '',
  contract_value numeric(14, 2) not null default 0,
  additional_works_value numeric(14, 2) not null default 0,
  expected_margin_percent numeric(5, 2) not null default 15,
  start_date date,
  expected_completion_date date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'on-hold', 'pending')),
  pm_id uuid references public.profiles (id) on delete set null,
  customer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table if not exists public.project_engineers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  engineer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, engineer_id)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  expected_cost_percent numeric(5, 2) not null default 0,
  target_budget numeric(14, 2) not null default 0,
  actual_expenses numeric(14, 2) not null default 0,
  actual_completion_percent numeric(5, 2) not null default 0,
  expected_duration text,
  status text not null default 'pending'
    check (status in ('completed', 'in-progress', 'pending')),
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists milestones_updated_at on public.milestones;
create trigger milestones_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  category text not null,
  description text not null default '',
  amount numeric(14, 2) not null default 0,
  vendor_name text,
  bill_number text,
  expense_date date not null default current_date,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  entered_by uuid references public.profiles (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  stage_name text not null,
  amount numeric(14, 2) not null default 0,
  due_date date,
  received_date date,
  status text not null default 'pending'
    check (status in ('pending', 'received', 'overdue')),
  payment_method text,
  reference_number text,
  notes text,
  entered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists client_payments_updated_at on public.client_payments;
create trigger client_payments_updated_at
  before update on public.client_payments
  for each row execute function public.set_updated_at();

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  vendor_name text not null,
  total_amount numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  pending_amount numeric(14, 2) generated always as (total_amount - amount_paid) stored,
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'paid', 'overdue')),
  category text,
  notes text,
  entered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists vendor_payments_updated_at on public.vendor_payments;
create trigger vendor_payments_updated_at
  before update on public.vendor_payments
  for each row execute function public.set_updated_at();

create table if not exists public.additional_works (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  description text not null,
  amount numeric(14, 2) not null default 0,
  requested_date date not null default current_date,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists additional_works_updated_at on public.additional_works;
create trigger additional_works_updated_at
  before update on public.additional_works
  for each row execute function public.set_updated_at();

create table if not exists public.labour_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_wage numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.labour_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  labour_type_id uuid not null references public.labour_types (id) on delete restrict,
  entry_date date not null default current_date,
  count integer not null default 0,
  wage_per_person numeric(14, 2) not null default 0,
  total_cost numeric(14, 2) not null default 0,
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists labour_entries_updated_at on public.labour_entries;
create trigger labour_entries_updated_at
  before update on public.labour_entries
  for each row execute function public.set_updated_at();

insert into public.labour_types (name, default_wage) values
  ('Mason', 800),
  ('Helper', 500),
  ('Carpenter', 900),
  ('Electrician', 850),
  ('Plumber', 850)
on conflict (name) do nothing;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_engineers enable row level security;
alter table public.milestones enable row level security;
alter table public.expenses enable row level security;
alter table public.client_payments enable row level security;
alter table public.vendor_payments enable row level security;
alter table public.additional_works enable row level security;
alter table public.labour_types enable row level security;
alter table public.labour_entries enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  coalesce(u.raw_user_meta_data ->> 'role', 'customer')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

drop policy if exists "Staff can manage projects" on public.projects;
create policy "Staff can manage projects"
  on public.projects for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Customers can view assigned projects" on public.projects;
create policy "Customers can view assigned projects"
  on public.projects for select to authenticated
  using (
    customer_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Staff manage project engineers" on public.project_engineers;
create policy "Staff manage project engineers"
  on public.project_engineers for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Customers can view project engineers" on public.project_engineers;
create policy "Customers can view project engineers"
  on public.project_engineers for select to authenticated
  using (
    exists (
      select 1 from public.projects pr
      where pr.id = project_id and pr.customer_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Staff manage milestones" on public.milestones;
create policy "Staff manage milestones" on public.milestones for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')));

drop policy if exists "Staff manage expenses" on public.expenses;
create policy "Staff manage expenses" on public.expenses for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')));

drop policy if exists "Staff manage client payments" on public.client_payments;
create policy "Staff manage client payments" on public.client_payments for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')));

drop policy if exists "Staff manage vendor payments" on public.vendor_payments;
create policy "Staff manage vendor payments" on public.vendor_payments for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')));

drop policy if exists "Staff manage additional works" on public.additional_works;
create policy "Staff manage additional works" on public.additional_works for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')));

drop policy if exists "Authenticated read labour types" on public.labour_types;
create policy "Authenticated read labour types" on public.labour_types for select to authenticated using (true);

drop policy if exists "Staff manage labour types" on public.labour_types;
create policy "Staff manage labour types" on public.labour_types for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')));

drop policy if exists "Staff manage labour entries" on public.labour_entries;
create policy "Staff manage labour entries" on public.labour_entries for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')));
