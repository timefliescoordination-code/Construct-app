-- Non-project company revenue (admin-only)

create table public.company_income (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  source_name text,
  received_date date not null default current_date,
  payment_method text,
  reference_number text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_income_updated_at
  before update on public.company_income
  for each row execute function public.set_updated_at();

create index company_income_received_date_idx on public.company_income (received_date desc);

alter table public.company_income enable row level security;

create policy "Admin manage company_income"
  on public.company_income
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
