-- Company overhead and admin personal expense ledgers (admin-only via RLS)

create table public.company_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  vendor_name text,
  expense_date date not null default current_date,
  payment_method text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_expenses_updated_at
  before update on public.company_expenses
  for each row execute function public.set_updated_at();

create index company_expenses_expense_date_idx on public.company_expenses (expense_date desc);

create table public.personal_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger personal_expenses_updated_at
  before update on public.personal_expenses
  for each row execute function public.set_updated_at();

create index personal_expenses_expense_date_idx on public.personal_expenses (expense_date desc);

alter table public.company_expenses enable row level security;
alter table public.personal_expenses enable row level security;

create policy "Admin manage company_expenses"
  on public.company_expenses
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

create policy "Admin manage personal_expenses"
  on public.personal_expenses
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
