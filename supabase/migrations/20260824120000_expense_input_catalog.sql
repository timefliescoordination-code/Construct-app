-- Company-wide master catalog for project expense categories and subcategories.
-- Expense rows keep category/description as text snapshots, so catalog edits
-- only affect upcoming entries.

create table if not exists public.expense_input_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  uses_labour_teams boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_input_categories_name_idx
  on public.expense_input_categories (lower(name));

drop trigger if exists expense_input_categories_updated_at on public.expense_input_categories;
create trigger expense_input_categories_updated_at
  before update on public.expense_input_categories
  for each row execute function public.set_updated_at();

create table if not exists public.expense_input_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_input_categories (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_input_subcategories_category_name_idx
  on public.expense_input_subcategories (category_id, lower(name));

drop trigger if exists expense_input_subcategories_updated_at on public.expense_input_subcategories;
create trigger expense_input_subcategories_updated_at
  before update on public.expense_input_subcategories
  for each row execute function public.set_updated_at();

alter table public.expense_input_categories enable row level security;
alter table public.expense_input_subcategories enable row level security;

drop policy if exists "Admins manage expense input categories" on public.expense_input_categories;
create policy "Admins manage expense input categories"
  on public.expense_input_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Staff read expense input categories" on public.expense_input_categories;
create policy "Staff read expense input categories"
  on public.expense_input_categories for select to authenticated
  using (true);

drop policy if exists "Admins manage expense input subcategories" on public.expense_input_subcategories;
create policy "Admins manage expense input subcategories"
  on public.expense_input_subcategories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Staff read expense input subcategories" on public.expense_input_subcategories;
create policy "Staff read expense input subcategories"
  on public.expense_input_subcategories for select to authenticated
  using (true);

do $$
declare
  materials_id uuid;
  labour_id uuid;
  equipment_id uuid;
  misc_id uuid;
begin
  if exists (select 1 from public.expense_input_categories) then
    return;
  end if;

  insert into public.expense_input_categories (name, uses_labour_teams, sort_order)
  values ('Materials', false, 1)
  returning id into materials_id;

  insert into public.expense_input_categories (name, uses_labour_teams, sort_order)
  values ('Labour', true, 2)
  returning id into labour_id;

  insert into public.expense_input_categories (name, uses_labour_teams, sort_order)
  values ('Equipment', false, 3)
  returning id into equipment_id;

  insert into public.expense_input_categories (name, uses_labour_teams, sort_order)
  values ('Miscellaneous', false, 4)
  returning id into misc_id;

  insert into public.expense_input_subcategories (category_id, name, sort_order)
  values
    (materials_id, 'Cement', 1),
    (materials_id, 'Steel', 2),
    (materials_id, 'Sand', 3),
    (materials_id, 'Bricks', 4),
    (materials_id, 'Tiles', 5),
    (materials_id, 'Paint', 6),
    (materials_id, 'Plumbing', 7),
    (materials_id, 'Electrical', 8),
    (equipment_id, 'Excavator', 1),
    (equipment_id, 'Crane', 2),
    (equipment_id, 'Mixer', 3),
    (equipment_id, 'Compactor', 4),
    (equipment_id, 'Generator', 5),
    (misc_id, 'Transportation', 1),
    (misc_id, 'Permits', 2),
    (misc_id, 'Insurance', 3),
    (misc_id, 'Utilities', 4),
    (misc_id, 'Other', 5);
end $$;

notify pgrst, 'reload schema';
