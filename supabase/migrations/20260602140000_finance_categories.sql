-- Editable categories for company/personal finance ledgers (admin-only)

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('company_expense', 'company_income', 'personal_expense')
  ),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index finance_categories_kind_name_idx
  on public.finance_categories (kind, name);

create index finance_categories_kind_sort_idx
  on public.finance_categories (kind, sort_order);

create trigger finance_categories_updated_at
  before update on public.finance_categories
  for each row execute function public.set_updated_at();

alter table public.finance_categories enable row level security;

create policy "Admin manage finance_categories"
  on public.finance_categories
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Default categories (skip if re-run)
insert into public.finance_categories (kind, name, sort_order)
select v.kind, v.name, v.ord
from (
  values
    ('company_expense', 'Office & Rent', 1),
    ('company_expense', 'Utilities', 2),
    ('company_expense', 'Vehicles & Fuel', 3),
    ('company_expense', 'Insurance', 4),
    ('company_expense', 'Admin Salaries', 5),
    ('company_expense', 'Marketing', 6),
    ('company_expense', 'Bank & Fees', 7),
    ('company_expense', 'Miscellaneous', 8),
    ('company_income', 'Service revenue', 1),
    ('company_income', 'Rental income', 2),
    ('company_income', 'Interest', 3),
    ('company_income', 'Refund', 4),
    ('company_income', 'Grant / subsidy', 5),
    ('company_income', 'Other income', 6),
    ('personal_expense', 'Food', 1),
    ('personal_expense', 'Transport', 2),
    ('personal_expense', 'Health', 3),
    ('personal_expense', 'Family', 4),
    ('personal_expense', 'Entertainment', 5),
    ('personal_expense', 'Shopping', 6),
    ('personal_expense', 'Other', 7)
) as v(kind, name, ord)
where not exists (
  select 1 from public.finance_categories fc where fc.kind = v.kind limit 1
);
