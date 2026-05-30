-- Material purchase history for Material Intelligence detail rows
-- Run in Supabase SQL Editor after material-intelligence-module.sql

create table if not exists public.material_purchases (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.material_master (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  vendor_name text,
  purchase_date date not null default current_date,
  rate numeric(14, 2) not null default 0,
  expense_id uuid references public.expenses (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists material_purchases_material_id_idx
  on public.material_purchases (material_id, purchase_date desc);

create index if not exists material_purchases_project_id_idx
  on public.material_purchases (project_id);

alter table public.material_purchases enable row level security;

drop policy if exists "Staff read material purchases" on public.material_purchases;
create policy "Staff read material purchases"
  on public.material_purchases for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Admins manage material purchases" on public.material_purchases;
create policy "Admins manage material purchases"
  on public.material_purchases for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
