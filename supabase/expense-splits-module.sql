-- Expense split payment groups
-- Run in Supabase SQL Editor after schema.sql and labour-teams-module.sql (if used)

create table if not exists public.expense_split_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  total_amount numeric(14, 2) not null,
  category text not null,
  description text not null default '',
  vendor_name text,
  bill_number text,
  milestone_id uuid references public.milestones (id) on delete set null,
  labour_team_id uuid references public.labour_teams (id) on delete set null,
  subcategory_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists expense_split_groups_updated_at on public.expense_split_groups;
create trigger expense_split_groups_updated_at
  before update on public.expense_split_groups
  for each row execute function public.set_updated_at();

alter table public.expenses
  add column if not exists split_group_id uuid references public.expense_split_groups (id) on delete cascade,
  add column if not exists split_number integer;

alter table public.expenses
  drop constraint if exists expenses_split_number_range;

alter table public.expenses
  add constraint expenses_split_number_range
  check (split_number is null or (split_number >= 1 and split_number <= 10));

create index if not exists expenses_split_group_id_idx
  on public.expenses (split_group_id)
  where split_group_id is not null;

alter table public.expense_split_groups enable row level security;

drop policy if exists "Staff manage expense split groups" on public.expense_split_groups;
create policy "Staff manage expense split groups"
  on public.expense_split_groups for all to authenticated
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

notify pgrst, 'reload schema';
