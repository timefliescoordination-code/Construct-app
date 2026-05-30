-- Invoice OCR: material links, mapping reviews, expense rate warnings
-- Run in Supabase SQL Editor after expense-invoices-module.sql and material-intelligence-module.sql

alter table public.invoice_items
  add column if not exists material_id uuid references public.material_master (id) on delete set null;

create index if not exists invoice_items_material_id_idx
  on public.invoice_items (material_id)
  where material_id is not null;

alter table public.expenses
  add column if not exists material_rate_warning boolean not null default false;

create table if not exists public.material_mapping_reviews (
  id uuid primary key default gen_random_uuid(),
  alias_name text not null,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  invoice_item_id uuid references public.invoice_items (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'mapped', 'dismissed')),
  mapped_material_id uuid references public.material_master (id) on delete set null,
  mapped_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists material_mapping_reviews_expense_id_idx
  on public.material_mapping_reviews (expense_id);

create index if not exists material_mapping_reviews_status_idx
  on public.material_mapping_reviews (status)
  where status = 'pending';

alter table public.material_mapping_reviews enable row level security;

drop policy if exists "Admins manage material mapping reviews" on public.material_mapping_reviews;
create policy "Admins manage material mapping reviews"
  on public.material_mapping_reviews for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage material mapping reviews on assigned projects" on public.material_mapping_reviews;
create policy "PMs manage material mapping reviews on assigned projects"
  on public.material_mapping_reviews for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_pm_for_project(e.project_id)
    )
  )
  with check (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.is_pm_for_project(e.project_id)
    )
  );

drop policy if exists "Staff read material mapping reviews on accessible projects" on public.material_mapping_reviews;
create policy "Staff read material mapping reviews on accessible projects"
  on public.material_mapping_reviews for select to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and (
          public.is_admin()
          or (public.current_user_role() = 'pm' and public.is_pm_for_project(e.project_id))
          or (
            exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
            and public.user_can_access_project(e.project_id)
          )
        )
    )
  );

notify pgrst, 'reload schema';
