-- Expense invoice uploads and line items (invoice upload, OCR line items)
-- Run in Supabase SQL Editor after schema.sql and assignment-scoped-access.sql

create table if not exists public.expense_invoices (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_mime_type text not null,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  invoice_total numeric(14, 2),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_invoices_expense_id_idx
  on public.expense_invoices (expense_id);

drop trigger if exists expense_invoices_updated_at on public.expense_invoices;
create trigger expense_invoices_updated_at
  before update on public.expense_invoices
  for each row execute function public.set_updated_at();

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  material_description_original text not null,
  material_description_standardized text,
  quantity numeric(14, 4),
  unit text,
  unit_rate numeric(14, 2),
  total_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists invoice_items_expense_id_idx
  on public.invoice_items (expense_id);

alter table public.expense_invoices enable row level security;
alter table public.invoice_items enable row level security;

-- expense_invoices RLS (scoped via parent expense project)

drop policy if exists "Admins manage expense invoices" on public.expense_invoices;
create policy "Admins manage expense invoices"
  on public.expense_invoices for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage expense invoices on assigned projects" on public.expense_invoices;
create policy "PMs manage expense invoices on assigned projects"
  on public.expense_invoices for all to authenticated
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

drop policy if exists "Engineers manage expense invoices on assigned projects" on public.expense_invoices;
create policy "Engineers manage expense invoices on assigned projects"
  on public.expense_invoices for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.user_can_access_project(e.project_id)
    )
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.user_can_access_project(e.project_id)
    )
  );

drop policy if exists "Customers view expense invoices on assigned projects" on public.expense_invoices;
create policy "Customers view expense invoices on assigned projects"
  on public.expense_invoices for select to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.user_can_access_project(e.project_id)
    )
  );

-- invoice_items RLS (scoped via parent expense project)

drop policy if exists "Admins manage invoice items" on public.invoice_items;
create policy "Admins manage invoice items"
  on public.invoice_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage invoice items on assigned projects" on public.invoice_items;
create policy "PMs manage invoice items on assigned projects"
  on public.invoice_items for all to authenticated
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

drop policy if exists "Engineers manage invoice items on assigned projects" on public.invoice_items;
create policy "Engineers manage invoice items on assigned projects"
  on public.invoice_items for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.user_can_access_project(e.project_id)
    )
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'engineer')
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.user_can_access_project(e.project_id)
    )
  );

drop policy if exists "Customers view invoice items on assigned projects" on public.invoice_items;
create policy "Customers view invoice items on assigned projects"
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id and public.user_can_access_project(e.project_id)
    )
  );

-- Supabase Storage bucket for invoice files

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-invoices',
  'expense-invoices',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff upload expense invoice files" on storage.objects;
create policy "Staff upload expense invoice files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expense-invoices'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Staff read expense invoice files" on storage.objects;
create policy "Staff read expense invoice files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expense-invoices'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Staff update expense invoice files" on storage.objects;
create policy "Staff update expense invoice files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'expense-invoices'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Staff delete expense invoice files" on storage.objects;
create policy "Staff delete expense invoice files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expense-invoices'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

notify pgrst, 'reload schema';
