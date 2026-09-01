-- Construction quality checklists, inspections, evidence, and approvals.
-- Integrates with existing projects + milestones (stages). No parallel stage system.

-- ---------------------------------------------------------------------------
-- Milestone quality fields (consumed by payment/stage later)
-- ---------------------------------------------------------------------------

alter table public.milestones
  add column if not exists requires_quality_approval boolean not null default false;

alter table public.milestones
  add column if not exists quality_approval_status text not null default 'not_required';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'milestones_quality_approval_status_check'
  ) then
    alter table public.milestones
      add constraint milestones_quality_approval_status_check
      check (
        quality_approval_status in (
          'not_required',
          'pending',
          'failed',
          'awaiting_correction',
          'ready_for_approval',
          'approved'
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Templates (versioned catalog)
-- ---------------------------------------------------------------------------

create table if not exists public.quality_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  work_type text not null default 'other' check (
    work_type in (
      'brickwork', 'rcc', 'foundation', 'column', 'beam', 'slab',
      'plastering', 'waterproofing', 'flooring', 'tiling', 'painting',
      'plumbing', 'electrical', 'doors_windows', 'external_works', 'other'
    )
  ),
  version integer not null default 1,
  is_published boolean not null default true,
  requires_pm_approval boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, version)
);

create index if not exists quality_checklist_templates_work_type_idx
  on public.quality_checklist_templates (work_type, is_published);

create table if not exists public.quality_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quality_checklist_templates (id) on delete cascade,
  category_name text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_critical boolean not null default false,
  is_required boolean not null default true,
  allow_na boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_checklist_template_items_template_idx
  on public.quality_checklist_template_items (template_id, sort_order);

create table if not exists public.quality_checklist_template_parameters (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.quality_checklist_template_items (id) on delete cascade,
  name text not null,
  parameter_type text not null check (
    parameter_type in (
      'numeric', 'ratio', 'text', 'single_select', 'multi_select', 'boolean', 'measurement'
    )
  ),
  unit text,
  requirement_label text,
  expected_value text,
  min_value numeric,
  max_value numeric,
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_checklist_template_parameters_item_idx
  on public.quality_checklist_template_parameters (item_id, sort_order);

-- Project assignment + per-project requirement overrides (does not mutate the catalog)
create table if not exists public.quality_project_checklists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid not null references public.milestones (id) on delete cascade,
  template_id uuid not null references public.quality_checklist_templates (id) on delete restrict,
  template_version integer not null,
  requires_pm_approval boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, milestone_id, template_id)
);

create index if not exists quality_project_checklists_project_idx
  on public.quality_project_checklists (project_id, milestone_id);

create table if not exists public.quality_project_parameter_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  template_parameter_id uuid not null references public.quality_checklist_template_parameters (id) on delete cascade,
  requirement_label text,
  expected_value text,
  min_value numeric,
  max_value numeric,
  unit text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, template_parameter_id)
);

create index if not exists quality_project_parameter_overrides_project_idx
  on public.quality_project_parameter_overrides (project_id);

-- ---------------------------------------------------------------------------
-- Inspections (snapshots requirements at start)
-- ---------------------------------------------------------------------------

create table if not exists public.quality_inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid not null references public.milestones (id) on delete restrict,
  template_id uuid not null references public.quality_checklist_templates (id) on delete restrict,
  template_version integer not null,
  inspection_number integer not null,
  parent_inspection_id uuid references public.quality_inspections (id) on delete set null,
  work_label text not null,
  location_label text,
  status text not null default 'draft' check (
    status in (
      'draft', 'in_progress', 'submitted', 'failed', 'awaiting_correction',
      'ready_for_reinspection', 'approved', 'rejected', 'closed'
    )
  ),
  overall_result text check (overall_result in ('pass', 'fail')),
  requires_pm_approval boolean not null default true,
  started_by uuid references public.profiles (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, inspection_number)
);

create index if not exists quality_inspections_project_idx
  on public.quality_inspections (project_id, created_at desc);

create index if not exists quality_inspections_milestone_idx
  on public.quality_inspections (milestone_id, created_at desc);

create index if not exists quality_inspections_status_idx
  on public.quality_inspections (status, created_at desc);

create table if not exists public.quality_inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.quality_inspections (id) on delete cascade,
  template_item_id uuid,
  category_name text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_critical boolean not null default false,
  is_required boolean not null default true,
  allow_na boolean not null default true,
  status text not null default 'not_checked' check (
    status in ('pass', 'fail', 'na', 'not_checked')
  ),
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_inspection_items_inspection_idx
  on public.quality_inspection_items (inspection_id, sort_order);

create table if not exists public.quality_inspection_parameter_results (
  id uuid primary key default gen_random_uuid(),
  inspection_item_id uuid not null references public.quality_inspection_items (id) on delete cascade,
  template_parameter_id uuid,
  name text not null,
  parameter_type text not null check (
    parameter_type in (
      'numeric', 'ratio', 'text', 'single_select', 'multi_select', 'boolean', 'measurement'
    )
  ),
  unit text,
  requirement_label text,
  expected_value text,
  min_value numeric,
  max_value numeric,
  options jsonb not null default '[]'::jsonb,
  actual_value text,
  actual_numeric numeric,
  status text not null default 'not_checked' check (
    status in ('pass', 'fail', 'na', 'not_checked')
  ),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_inspection_parameter_results_item_idx
  on public.quality_inspection_parameter_results (inspection_item_id, sort_order);

create table if not exists public.quality_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  inspection_id uuid not null references public.quality_inspections (id) on delete cascade,
  inspection_item_id uuid not null references public.quality_inspection_items (id) on delete cascade,
  remark text,
  corrective_action text,
  responsible_person_id uuid references public.profiles (id) on delete set null,
  target_date date,
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'ready_for_reinspection', 'closed')
  ),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quality_corrective_actions_inspection_idx
  on public.quality_corrective_actions (inspection_id, status);

create index if not exists quality_corrective_actions_project_idx
  on public.quality_corrective_actions (project_id, status);

create table if not exists public.quality_inspection_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  inspection_id uuid not null references public.quality_inspections (id) on delete cascade,
  inspection_item_id uuid references public.quality_inspection_items (id) on delete set null,
  corrective_action_id uuid references public.quality_corrective_actions (id) on delete set null,
  level text not null default 'item' check (level in ('inspection', 'item', 'failure')),
  file_path text not null,
  file_name text not null,
  file_mime_type text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists quality_inspection_photos_inspection_idx
  on public.quality_inspection_photos (inspection_id, created_at desc);

create table if not exists public.quality_inspection_approvals (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.quality_inspections (id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected', 'request_correction')),
  remark text,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  created_at timestamptz not null default now()
);

create index if not exists quality_inspection_approvals_inspection_idx
  on public.quality_inspection_approvals (inspection_id, created_at desc);

create table if not exists public.quality_inspection_audit_events (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.quality_inspections (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  comments text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quality_inspection_audit_inspection_idx
  on public.quality_inspection_audit_events (inspection_id, created_at);

-- Inspection number per project
create or replace function public.next_quality_inspection_number(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  select coalesce(max(inspection_number), 0) + 1
    into seq
  from public.quality_inspections
  where project_id = p_project_id;
  return seq;
end;
$$;

drop trigger if exists quality_checklist_templates_updated_at on public.quality_checklist_templates;
create trigger quality_checklist_templates_updated_at
  before update on public.quality_checklist_templates
  for each row execute function public.set_updated_at();

drop trigger if exists quality_checklist_template_items_updated_at on public.quality_checklist_template_items;
create trigger quality_checklist_template_items_updated_at
  before update on public.quality_checklist_template_items
  for each row execute function public.set_updated_at();

drop trigger if exists quality_checklist_template_parameters_updated_at on public.quality_checklist_template_parameters;
create trigger quality_checklist_template_parameters_updated_at
  before update on public.quality_checklist_template_parameters
  for each row execute function public.set_updated_at();

drop trigger if exists quality_project_checklists_updated_at on public.quality_project_checklists;
create trigger quality_project_checklists_updated_at
  before update on public.quality_project_checklists
  for each row execute function public.set_updated_at();

drop trigger if exists quality_project_parameter_overrides_updated_at on public.quality_project_parameter_overrides;
create trigger quality_project_parameter_overrides_updated_at
  before update on public.quality_project_parameter_overrides
  for each row execute function public.set_updated_at();

drop trigger if exists quality_inspections_updated_at on public.quality_inspections;
create trigger quality_inspections_updated_at
  before update on public.quality_inspections
  for each row execute function public.set_updated_at();

drop trigger if exists quality_inspection_items_updated_at on public.quality_inspection_items;
create trigger quality_inspection_items_updated_at
  before update on public.quality_inspection_items
  for each row execute function public.set_updated_at();

drop trigger if exists quality_inspection_parameter_results_updated_at on public.quality_inspection_parameter_results;
create trigger quality_inspection_parameter_results_updated_at
  before update on public.quality_inspection_parameter_results
  for each row execute function public.set_updated_at();

drop trigger if exists quality_corrective_actions_updated_at on public.quality_corrective_actions;
create trigger quality_corrective_actions_updated_at
  before update on public.quality_corrective_actions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.quality_checklist_templates enable row level security;
alter table public.quality_checklist_template_items enable row level security;
alter table public.quality_checklist_template_parameters enable row level security;
alter table public.quality_project_checklists enable row level security;
alter table public.quality_project_parameter_overrides enable row level security;
alter table public.quality_inspections enable row level security;
alter table public.quality_inspection_items enable row level security;
alter table public.quality_inspection_parameter_results enable row level security;
alter table public.quality_corrective_actions enable row level security;
alter table public.quality_inspection_photos enable row level security;
alter table public.quality_inspection_approvals enable row level security;
alter table public.quality_inspection_audit_events enable row level security;

-- Templates: staff can read published; admin manages
drop policy if exists "Staff read quality templates" on public.quality_checklist_templates;
create policy "Staff read quality templates"
  on public.quality_checklist_templates for select to authenticated
  using (public.current_user_role() in ('admin', 'pm', 'engineer'));

drop policy if exists "Admins manage quality templates" on public.quality_checklist_templates;
create policy "Admins manage quality templates"
  on public.quality_checklist_templates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read quality template items" on public.quality_checklist_template_items;
create policy "Staff read quality template items"
  on public.quality_checklist_template_items for select to authenticated
  using (public.current_user_role() in ('admin', 'pm', 'engineer'));

drop policy if exists "Admins manage quality template items" on public.quality_checklist_template_items;
create policy "Admins manage quality template items"
  on public.quality_checklist_template_items for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read quality template parameters" on public.quality_checklist_template_parameters;
create policy "Staff read quality template parameters"
  on public.quality_checklist_template_parameters for select to authenticated
  using (public.current_user_role() in ('admin', 'pm', 'engineer'));

drop policy if exists "Admins manage quality template parameters" on public.quality_checklist_template_parameters;
create policy "Admins manage quality template parameters"
  on public.quality_checklist_template_parameters for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Project assignments
drop policy if exists "Staff read project quality checklists" on public.quality_project_checklists;
create policy "Staff read project quality checklists"
  on public.quality_project_checklists for select to authenticated
  using (public.user_can_access_project(project_id) and public.current_user_role() <> 'customer');

drop policy if exists "PM admin manage project quality checklists" on public.quality_project_checklists;
create policy "PM admin manage project quality checklists"
  on public.quality_project_checklists for all to authenticated
  using (public.is_admin() or public.is_pm_for_project(project_id))
  with check (public.is_admin() or public.is_pm_for_project(project_id));

drop policy if exists "Staff read quality parameter overrides" on public.quality_project_parameter_overrides;
create policy "Staff read quality parameter overrides"
  on public.quality_project_parameter_overrides for select to authenticated
  using (public.user_can_access_project(project_id) and public.current_user_role() <> 'customer');

drop policy if exists "PM admin manage quality parameter overrides" on public.quality_project_parameter_overrides;
create policy "PM admin manage quality parameter overrides"
  on public.quality_project_parameter_overrides for all to authenticated
  using (public.is_admin() or public.is_pm_for_project(project_id))
  with check (public.is_admin() or public.is_pm_for_project(project_id));

-- Inspections
drop policy if exists "Staff read quality inspections" on public.quality_inspections;
create policy "Staff read quality inspections"
  on public.quality_inspections for select to authenticated
  using (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  );

drop policy if exists "Staff insert quality inspections" on public.quality_inspections;
create policy "Staff insert quality inspections"
  on public.quality_inspections for insert to authenticated
  with check (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  );

drop policy if exists "Staff update quality inspections" on public.quality_inspections;
create policy "Staff update quality inspections"
  on public.quality_inspections for update to authenticated
  using (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  )
  with check (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  );

-- Child rows via inspection
drop policy if exists "Staff read quality inspection items" on public.quality_inspection_items;
create policy "Staff read quality inspection items"
  on public.quality_inspection_items for select to authenticated
  using (
    exists (
      select 1 from public.quality_inspections i
      where i.id = inspection_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  );

drop policy if exists "Staff write quality inspection items" on public.quality_inspection_items;
create policy "Staff write quality inspection items"
  on public.quality_inspection_items for all to authenticated
  using (
    exists (
      select 1 from public.quality_inspections i
      where i.id = inspection_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.quality_inspections i
      where i.id = inspection_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  );

drop policy if exists "Staff read quality parameter results" on public.quality_inspection_parameter_results;
create policy "Staff read quality parameter results"
  on public.quality_inspection_parameter_results for select to authenticated
  using (
    exists (
      select 1
      from public.quality_inspection_items it
      join public.quality_inspections i on i.id = it.inspection_id
      where it.id = inspection_item_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  );

drop policy if exists "Staff write quality parameter results" on public.quality_inspection_parameter_results;
create policy "Staff write quality parameter results"
  on public.quality_inspection_parameter_results for all to authenticated
  using (
    exists (
      select 1
      from public.quality_inspection_items it
      join public.quality_inspections i on i.id = it.inspection_id
      where it.id = inspection_item_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.quality_inspection_items it
      join public.quality_inspections i on i.id = it.inspection_id
      where it.id = inspection_item_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  );

drop policy if exists "Staff access quality corrective actions" on public.quality_corrective_actions;
create policy "Staff access quality corrective actions"
  on public.quality_corrective_actions for all to authenticated
  using (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  )
  with check (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  );

drop policy if exists "Staff access quality inspection photos" on public.quality_inspection_photos;
create policy "Staff access quality inspection photos"
  on public.quality_inspection_photos for all to authenticated
  using (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  )
  with check (
    public.is_admin()
    or public.is_pm_for_project(project_id)
    or public.is_engineer_for_project(project_id)
  );

drop policy if exists "Staff read quality inspection approvals" on public.quality_inspection_approvals;
create policy "Staff read quality inspection approvals"
  on public.quality_inspection_approvals for select to authenticated
  using (
    exists (
      select 1 from public.quality_inspections i
      where i.id = inspection_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  );

drop policy if exists "PM admin insert quality inspection approvals" on public.quality_inspection_approvals;
create policy "PM admin insert quality inspection approvals"
  on public.quality_inspection_approvals for insert to authenticated
  with check (
    exists (
      select 1 from public.quality_inspections i
      where i.id = inspection_id
        and (public.is_admin() or public.is_pm_for_project(i.project_id))
    )
  );

drop policy if exists "Staff read quality inspection audit" on public.quality_inspection_audit_events;
create policy "Staff read quality inspection audit"
  on public.quality_inspection_audit_events for select to authenticated
  using (
    exists (
      select 1 from public.quality_inspections i
      where i.id = inspection_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  );

drop policy if exists "Staff insert quality inspection audit" on public.quality_inspection_audit_events;
create policy "Staff insert quality inspection audit"
  on public.quality_inspection_audit_events for insert to authenticated
  with check (
    exists (
      select 1 from public.quality_inspections i
      where i.id = inspection_id
        and (
          public.is_admin()
          or public.is_pm_for_project(i.project_id)
          or public.is_engineer_for_project(i.project_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage (reuses site-photo watermark pipeline; private bucket)
-- Path: {projectId}/{inspectionId}/{photoId}.jpg
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quality-inspection-photos',
  'quality-inspection-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Staff upload quality inspection photos" on storage.objects;
create policy "Staff upload quality inspection photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quality-inspection-photos'
    and (
      public.is_admin()
      or public.is_pm_for_project(((storage.foldername(name))[1])::uuid)
      or public.is_engineer_for_project(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "Staff read quality inspection photos" on storage.objects;
create policy "Staff read quality inspection photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quality-inspection-photos'
    and (
      public.is_admin()
      or public.is_pm_for_project(((storage.foldername(name))[1])::uuid)
      or public.is_engineer_for_project(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "Staff delete quality inspection photos" on storage.objects;
create policy "Staff delete quality inspection photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quality-inspection-photos'
    and (
      public.is_admin()
      or public.is_pm_for_project(((storage.foldername(name))[1])::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- Brickwork template v1
-- ---------------------------------------------------------------------------

do $$
declare
  v_template_id uuid;
  v_item_id uuid;
begin
  if exists (
    select 1 from public.quality_checklist_templates
    where slug = 'brickwork' and version = 1
  ) then
    return;
  end if;

  insert into public.quality_checklist_templates (
    slug, name, description, work_type, version, is_published, requires_pm_approval
  ) values (
    'brickwork',
    'Brickwork Inspection',
    'Quality inspection for brick masonry. Requirement values are defaults and can be overridden per project.',
    'brickwork',
    1,
    true,
    true
  ) returning id into v_template_id;

  -- 1. Brick quality & preparation
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Brick quality & preparation', 'Brick quality & preparation',
    'Check brick quality, soaking, and rejection of damaged units.',
    1, false, true, false
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, requirement_label, expected_value, options, sort_order
  ) values
    (v_item_id, 'Bricks soaked before use', 'boolean', 'Yes', 'yes', '[]'::jsonb, 1),
    (v_item_id, 'Damaged / broken bricks rejected', 'boolean', 'Yes', 'yes', '[]'::jsonb, 2),
    (v_item_id, 'Brick frog / orientation', 'single_select', 'Proper as per specification', 'proper',
      '[{"value":"proper","label":"Proper","result":"pass"},{"value":"irregular","label":"Irregular","result":"fail"}]'::jsonb, 3);

  -- 2. Mortar mix & joints (critical)
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Mortar mix & joints', 'Mortar mix & joints',
    'Verify mortar ratio, joint thickness, consistency, and filling.',
    2, true, true, false
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, unit, requirement_label, expected_value, min_value, max_value, options, sort_order
  ) values
    (v_item_id, 'Mortar ratio', 'ratio', 'ratio', '1:6', '1:6', null, null, '[]'::jsonb, 1),
    (v_item_id, 'Joint thickness', 'measurement', 'mm', '10–12 mm', null, 10, 12, '[]'::jsonb, 2),
    (v_item_id, 'Mortar consistency', 'single_select', null, 'Proper', 'proper', null, null,
      '[{"value":"proper","label":"Proper","result":"pass"},{"value":"too_dry","label":"Too dry","result":"fail"},{"value":"too_wet","label":"Too wet","result":"fail"}]'::jsonb, 3),
    (v_item_id, 'Horizontal joints fully filled', 'boolean', null, 'Yes', 'yes', null, null, '[]'::jsonb, 4),
    (v_item_id, 'Vertical joints fully filled', 'boolean', null, 'Yes', 'yes', null, null, '[]'::jsonb, 5);

  -- 3. Line, level & verticality (critical)
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Line, level & verticality', 'Line, level & verticality',
    'Check wall plumb, line, and course levels.',
    3, true, true, false
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, unit, requirement_label, expected_value, min_value, max_value, options, sort_order
  ) values
    (v_item_id, 'Wall verticality deviation', 'measurement', 'mm', 'Maximum 10 mm', null, null, 10, '[]'::jsonb, 1),
    (v_item_id, 'Alignment / line', 'single_select', null, 'Within tolerance', 'within_tolerance', null, null,
      '[{"value":"within_tolerance","label":"Within tolerance","result":"pass"},{"value":"out_of_line","label":"Out of line","result":"fail"}]'::jsonb, 2),
    (v_item_id, 'Course level', 'single_select', null, 'Uniform', 'uniform', null, null,
      '[{"value":"uniform","label":"Uniform","result":"pass"},{"value":"uneven","label":"Uneven","result":"fail"}]'::jsonb, 3);

  -- 4. Bonding & wall junctions (critical)
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Bonding & wall junctions', 'Bonding & wall junctions',
    'Confirm specified bond and proper junction detailing.',
    4, true, true, false
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, requirement_label, expected_value, options, sort_order
  ) values
    (v_item_id, 'Bond type as specified', 'text', 'As per drawing / specification', null, '[]'::jsonb, 1),
    (v_item_id, 'Wall junctions properly bonded', 'boolean', 'Yes', 'yes', '[]'::jsonb, 2),
    (v_item_id, 'Toothing / stepping provided where required', 'boolean', 'Yes', 'yes', '[]'::jsonb, 3);

  -- 5. Openings & dimensions
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Openings & dimensions', 'Openings & dimensions',
    'Check opening sizes, lintel bearing, and levels against drawings.',
    5, false, true, true
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, unit, requirement_label, expected_value, min_value, max_value, options, sort_order
  ) values
    (v_item_id, 'Opening width', 'measurement', 'mm', 'As per drawing', null, null, null, '[]'::jsonb, 1),
    (v_item_id, 'Opening height', 'measurement', 'mm', 'As per drawing', null, null, null, '[]'::jsonb, 2),
    (v_item_id, 'Lintel bearing', 'measurement', 'mm', 'Minimum 150 mm', null, 150, null, '[]'::jsonb, 3),
    (v_item_id, 'Lintel level / elevation', 'text', null, 'As per drawing', null, null, null, '[]'::jsonb, 4);

  -- 6. RCC / brickwork connections (critical)
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'RCC/brickwork connections', 'RCC/brickwork connections',
    'Structural connection, starter bars/ties, and packing at RCC interfaces.',
    6, true, true, false
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, requirement_label, expected_value, options, sort_order
  ) values
    (v_item_id, 'Starter bars / wall ties provided', 'boolean', 'Yes', 'yes', '[]'::jsonb, 1),
    (v_item_id, 'Connection as per drawing', 'boolean', 'Yes', 'yes', '[]'::jsonb, 2),
    (v_item_id, 'RCC interface packing', 'single_select', 'Properly packed', 'properly_packed',
      '[{"value":"properly_packed","label":"Properly packed","result":"pass"},{"value":"gaps_present","label":"Gaps present","result":"fail"}]'::jsonb, 3);

  -- 7. Electrical & plumbing provisions
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Electrical & plumbing provisions', 'Electrical & plumbing provisions',
    'Confirm sleeves and conduits left as required. Mark N/A if not applicable.',
    7, false, true, true
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, requirement_label, expected_value, options, sort_order
  ) values
    (v_item_id, 'Required provisions', 'multi_select', 'As per MEP drawing', null,
      '[{"value":"electrical_conduit","label":"Electrical conduit"},{"value":"plumbing_sleeve","label":"Plumbing sleeve"},{"value":"ac_sleeve","label":"AC sleeve"}]'::jsonb, 1),
    (v_item_id, 'Sleeves / conduits as per drawing', 'boolean', 'Yes', 'yes', '[]'::jsonb, 2);

  -- 8. Curing & workmanship
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Curing & workmanship', 'Curing & workmanship',
    'Curing method, duration, and overall workmanship.',
    8, false, true, false
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, unit, requirement_label, expected_value, min_value, max_value, options, sort_order
  ) values
    (v_item_id, 'Curing duration', 'numeric', 'days', 'Minimum 7 days', null, 7, null, '[]'::jsonb, 1),
    (v_item_id, 'Curing method', 'single_select', null, 'Wet curing', 'wet_hessian', null, null,
      '[{"value":"wet_hessian","label":"Wet hessian / ponding","result":"pass"},{"value":"sprinkling","label":"Sprinkling","result":"pass"},{"value":"none","label":"None","result":"fail"}]'::jsonb, 2),
    (v_item_id, 'Workmanship', 'single_select', null, 'Satisfactory', 'satisfactory', null, null,
      '[{"value":"satisfactory","label":"Satisfactory","result":"pass"},{"value":"poor","label":"Poor","result":"fail"}]'::jsonb, 3);

  -- 9. Surface readiness for plastering
  insert into public.quality_checklist_template_items (
    template_id, category_name, title, description, sort_order, is_critical, is_required, allow_na
  ) values (
    v_template_id, 'Surface readiness for plastering', 'Surface readiness for plastering',
    'Joints raked, surface clean, ready for plaster.',
    9, false, true, true
  ) returning id into v_item_id;

  insert into public.quality_checklist_template_parameters (
    item_id, name, parameter_type, requirement_label, expected_value, options, sort_order
  ) values
    (v_item_id, 'Joints raked', 'boolean', 'Yes', 'yes', '[]'::jsonb, 1),
    (v_item_id, 'Surface clean and free of loose mortar', 'boolean', 'Yes', 'yes', '[]'::jsonb, 2),
    (v_item_id, 'Ready for plastering', 'boolean', 'Yes', 'yes', '[]'::jsonb, 3);
end $$;

grant execute on function public.next_quality_inspection_number(uuid) to authenticated;

grant select, insert, update, delete on table
  public.quality_checklist_templates,
  public.quality_checklist_template_items,
  public.quality_checklist_template_parameters,
  public.quality_project_checklists,
  public.quality_project_parameter_overrides,
  public.quality_inspections,
  public.quality_inspection_items,
  public.quality_inspection_parameter_results,
  public.quality_corrective_actions,
  public.quality_inspection_photos,
  public.quality_inspection_approvals,
  public.quality_inspection_audit_events
to authenticated;

notify pgrst, 'reload schema';
