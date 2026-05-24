-- Run this in Supabase SQL Editor if your database was created before project_engineers existed.

create table if not exists public.project_engineers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  engineer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, engineer_id)
);

alter table public.project_engineers enable row level security;

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
