-- Material Intelligence: standardized material catalog and vendor alias mappings
-- Supabase CLI migration (equivalent to material-intelligence-module.sql)

create table if not exists public.material_master (
  id uuid primary key default gen_random_uuid(),
  material_name text not null,
  category text,
  average_rate numeric(14, 2) not null default 0,
  latest_rate numeric(14, 2) not null default 0,
  previous_rate numeric(14, 2) not null default 0,
  purchase_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists material_master_name_lower_idx
  on public.material_master (lower(trim(material_name)));

create index if not exists material_master_category_idx
  on public.material_master (category);

drop trigger if exists material_master_updated_at on public.material_master;
create trigger material_master_updated_at
  before update on public.material_master
  for each row execute function public.set_updated_at();

create or replace function public.material_master_track_rate_change()
returns trigger
language plpgsql
as $$
begin
  if new.latest_rate is distinct from old.latest_rate then
    new.previous_rate := old.latest_rate;
  end if;
  return new;
end;
$$;

drop trigger if exists material_master_track_rate_change on public.material_master;
create trigger material_master_track_rate_change
  before update of latest_rate on public.material_master
  for each row execute function public.material_master_track_rate_change();

create table if not exists public.material_aliases (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.material_master (id) on delete cascade,
  alias_name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists material_aliases_alias_name_lower_idx
  on public.material_aliases (lower(trim(alias_name)));

create index if not exists material_aliases_material_id_idx
  on public.material_aliases (material_id);

alter table public.material_master enable row level security;
alter table public.material_aliases enable row level security;

drop policy if exists "Staff read material master" on public.material_master;
create policy "Staff read material master"
  on public.material_master for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Admins manage material master" on public.material_master;
create policy "Admins manage material master"
  on public.material_master for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read material aliases" on public.material_aliases;
create policy "Staff read material aliases"
  on public.material_aliases for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Admins manage material aliases" on public.material_aliases;
create policy "Admins manage material aliases"
  on public.material_aliases for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
