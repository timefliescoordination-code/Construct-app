-- Company labour catalog: teams (expense dropdown) with linked roles (manpower columns).
-- Weekly manpower posts to Labour expenses only when manpower_weeks.show_in_expense is true.

alter table public.labour_teams
  alter column project_id drop not null;

drop index if exists public.labour_teams_project_name_idx;

alter table public.labour_types
  add column if not exists labour_team_id uuid references public.labour_teams (id) on delete restrict;

drop index if exists public.labour_types_project_name_idx;

alter table public.manpower_weeks
  add column if not exists show_in_expense boolean not null default false;

alter table public.expenses
  add column if not exists manpower_week_id uuid references public.manpower_weeks (id) on delete set null;

create index if not exists expenses_manpower_week_id_idx
  on public.expenses (manpower_week_id)
  where manpower_week_id is not null;

create index if not exists labour_types_labour_team_id_idx
  on public.labour_types (labour_team_id)
  where labour_team_id is not null;

-- ---------------------------------------------------------------------------
-- Seed company teams and roles
-- ---------------------------------------------------------------------------
insert into public.labour_teams (project_id, name, sort_order)
select null, v.name, v.sort_order
from (values
  ('Civil Team', 1),
  ('Tiles Team', 2),
  ('Granite Team', 3),
  ('Electrical and Plumbing Team', 4),
  ('Carpenter Team', 5),
  ('Painter Team', 6),
  ('MS Work Team', 7)
) as v(name, sort_order)
where not exists (
  select 1
  from public.labour_teams t
  where t.project_id is null
    and lower(t.name) = lower(v.name)
);

insert into public.labour_types (
  project_id, labour_team_id, name, short_label, default_wage, sort_order
)
select null, t.id, v.name, v.short_label, v.default_wage, v.sort_order
from public.labour_teams t
join (values
  ('Civil Team', 'Head Mason', 'H.Msn', 1200, 1),
  ('Civil Team', 'Mason', 'Mason', 1000, 2),
  ('Civil Team', 'Helper', 'Helper', 700, 3),
  ('Civil Team', 'Sithal', 'Sithal', 800, 4),
  ('Tiles Team', 'Head Mason', 'H.Msn', 1200, 1),
  ('Tiles Team', 'Mason', 'Mason', 1000, 2),
  ('Tiles Team', 'Helper', 'Helper', 700, 3),
  ('Tiles Team', 'Sithal', 'Sithal', 800, 4),
  ('Tiles Team', 'Stone Cutter', 'St.Cut', 950, 5),
  ('Granite Team', 'Head Mason', 'H.Msn', 1200, 1),
  ('Granite Team', 'Mason', 'Mason', 1000, 2),
  ('Granite Team', 'Helper', 'Helper', 700, 3),
  ('Granite Team', 'Sithal', 'Sithal', 800, 4),
  ('Electrical and Plumbing Team', 'Head Electrician', 'H.Elec', 1100, 1),
  ('Electrical and Plumbing Team', 'Electrician', 'Elec', 1000, 2),
  ('Electrical and Plumbing Team', 'Helper', 'Helper', 700, 3),
  ('Electrical and Plumbing Team', 'Stone Cutter', 'St.Cut', 950, 4),
  ('Carpenter Team', 'Head Carpenter', 'H.Carp', 1100, 1),
  ('Carpenter Team', 'Carpenter', 'Carp', 900, 2),
  ('Painter Team', 'Head Painter', 'H.Pnt', 1000, 1),
  ('Painter Team', 'Painter', 'Painter', 900, 2),
  ('MS Work Team', 'MS Workers', 'MS', 1000, 1)
) as v(team_name, name, short_label, default_wage, sort_order)
  on lower(t.name) = lower(v.team_name)
where t.project_id is null
  and not exists (
    select 1
    from public.labour_types ty
    where ty.project_id is null
      and ty.labour_team_id = t.id
      and lower(ty.name) = lower(v.name)
  );

-- ---------------------------------------------------------------------------
-- Rename / merge existing project teams onto the catalog names
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  canonical text;
  survivor uuid;
  normalized text;
begin
  for r in
    select id, project_id, name
    from public.labour_teams
    where project_id is not null
  loop
    normalized := regexp_replace(lower(trim(r.name)), '\s+', ' ', 'g');
    canonical := case
      when normalized in ('civil team', 'civil') then 'Civil Team'
      when normalized in ('tile team', 'tiles team', 'tile', 'tiles') then 'Tiles Team'
      when normalized in ('granite team', 'granite') then 'Granite Team'
      when normalized in (
        'electrical team',
        'electrician team',
        'plumber team',
        'plumbing team',
        'electrical and plumbing team',
        'electrical & plumbing team'
      ) then 'Electrical and Plumbing Team'
      when normalized in ('carpenter team', 'carpenter') then 'Carpenter Team'
      when normalized in ('painter team', 'painter') then 'Painter Team'
      when position('ms work' in normalized) > 0
        or (position('grill' in normalized) > 0 and position('gate' in normalized) > 0)
        then 'MS Work Team'
      else trim(r.name)
    end;

    if r.name = canonical then
      continue;
    end if;

    select t.id
    into survivor
    from public.labour_teams t
    where t.project_id = r.project_id
      and t.id <> r.id
      and lower(t.name) = lower(canonical)
    limit 1;

    if survivor is not null then
      update public.expenses
      set labour_team_id = survivor
      where labour_team_id = r.id;

      update public.labour_types
      set labour_team_id = survivor
      where labour_team_id = r.id;

      delete from public.labour_teams where id = r.id;
    else
      update public.labour_teams
      set name = canonical
      where id = r.id;
    end if;
  end loop;
end $$;

create unique index if not exists labour_teams_global_name_idx
  on public.labour_teams (lower(name))
  where project_id is null;

create unique index if not exists labour_teams_project_name_idx
  on public.labour_teams (project_id, lower(name))
  where project_id is not null;

-- Copy catalog teams onto projects that are missing them
insert into public.labour_teams (project_id, name, sort_order)
select p.id, g.name, g.sort_order
from public.projects p
cross join public.labour_teams g
where g.project_id is null
  and not exists (
    select 1
    from public.labour_teams t
    where t.project_id = p.id
      and lower(t.name) = lower(g.name)
  );

-- Attach existing project roles to the first catalog team that lists that role
with first_team as (
  select distinct on (lower(ty.name))
    ty.name as role_name,
    t.name as team_name
  from public.labour_types ty
  join public.labour_teams t on t.id = ty.labour_team_id
  where ty.project_id is null
    and t.project_id is null
  order by lower(ty.name), t.sort_order, ty.sort_order
)
update public.labour_types lt
set labour_team_id = pt.id
from first_team ft
join public.labour_teams pt
  on lower(pt.name) = lower(ft.team_name)
where lt.project_id is not null
  and lt.labour_team_id is null
  and pt.project_id = lt.project_id
  and lower(lt.name) = lower(ft.role_name);

create unique index if not exists labour_types_global_team_name_idx
  on public.labour_types (labour_team_id, lower(name))
  where project_id is null and labour_team_id is not null;

create unique index if not exists labour_types_project_team_name_idx
  on public.labour_types (project_id, labour_team_id, lower(name))
  where project_id is not null and labour_team_id is not null;

create unique index if not exists labour_types_project_unassigned_name_idx
  on public.labour_types (project_id, lower(name))
  where project_id is not null and labour_team_id is null;

-- Copy remaining catalog roles onto each project team
insert into public.labour_types (
  project_id, labour_team_id, name, short_label, default_wage, sort_order
)
select pt.project_id, pt.id, gty.name, gty.short_label, gty.default_wage, gty.sort_order
from public.labour_teams pt
join public.labour_teams gt
  on gt.project_id is null
 and lower(gt.name) = lower(pt.name)
join public.labour_types gty
  on gty.labour_team_id = gt.id
 and gty.project_id is null
where pt.project_id is not null
  and not exists (
    select 1
    from public.labour_types lty
    where lty.project_id = pt.project_id
      and lty.labour_team_id = pt.id
      and lower(lty.name) = lower(gty.name)
  );

insert into public.manpower_week_rates (week_id, labour_type_id, daily_rate)
select w.id, lt.id, lt.default_wage
from public.manpower_weeks w
join public.labour_types lt on lt.project_id = w.project_id
where not exists (
  select 1
  from public.manpower_week_rates r
  where r.week_id = w.id
    and r.labour_type_id = lt.id
);

delete from public.labour_types lt
where lt.project_id is null
  and lt.labour_team_id is null
  and not exists (
    select 1 from public.labour_entries e where e.labour_type_id = lt.id
  )
  and not exists (
    select 1 from public.manpower_week_rates r where r.labour_type_id = lt.id
  );

drop policy if exists "Users view labour teams on accessible projects" on public.labour_teams;
create policy "Users view labour teams on accessible projects"
  on public.labour_teams for select to authenticated
  using (
    project_id is null
    or public.user_can_access_project(project_id)
  );

notify pgrst, 'reload schema';
