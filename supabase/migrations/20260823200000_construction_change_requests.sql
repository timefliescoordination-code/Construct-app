-- Customer construction change requests, costing, approvals, and attachments

-- ---------------------------------------------------------------------------
-- Enums via check constraints (matches app types)
-- ---------------------------------------------------------------------------

create table if not exists public.construction_change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  request_number text not null,
  title text not null,
  description text not null,
  category text not null check (
    category in (
      'design', 'material', 'electrical', 'plumbing',
      'civil_work', 'finishing', 'other'
    )
  ),
  related_milestone_id uuid references public.milestones (id) on delete set null,
  preferred_completion_date date,
  status text not null default 'draft' check (
    status in (
      'draft', 'submitted', 'under_review', 'costing_prepared',
      'internal_approval_pending', 'customer_approval_pending',
      'approved', 'scheduled', 'in_progress', 'completed',
      'rejected', 'cancelled'
    )
  ),
  assigned_reviewer_id uuid references public.profiles (id) on delete set null,
  estimated_additional_days integer,
  affected_milestone_id uuid references public.milestones (id) on delete set null,
  internal_notes text,
  customer_visible_explanation text,
  active_costing_revision_id uuid,
  additional_work_id uuid references public.additional_works (id) on delete set null,
  client_payment_id uuid references public.client_payments (id) on delete set null,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, request_number)
);

create index if not exists construction_change_requests_project_idx
  on public.construction_change_requests (project_id, created_at desc);

create index if not exists construction_change_requests_status_idx
  on public.construction_change_requests (status, created_at desc);

create table if not exists public.construction_change_request_attachments (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.construction_change_requests (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  file_path text not null,
  file_name text not null,
  file_mime_type text not null,
  visibility text not null default 'customer' check (visibility in ('customer', 'internal')),
  created_at timestamptz not null default now()
);

create index if not exists construction_change_attachments_request_idx
  on public.construction_change_request_attachments (change_request_id, created_at);

create table if not exists public.construction_change_costing_revisions (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.construction_change_requests (id) on delete cascade,
  revision_number integer not null,
  author_id uuid not null references public.profiles (id) on delete restrict,
  reason_for_change text,
  estimated_additional_days integer,
  affected_milestone_id uuid references public.milestones (id) on delete set null,
  internal_notes text,
  customer_visible_explanation text,
  total_price numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (change_request_id, revision_number)
);

create table if not exists public.construction_change_costing_rows (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.construction_change_costing_revisions (id) on delete cascade,
  line_order integer not null default 0,
  description text not null,
  unit text not null,
  price numeric(14, 2) not null default 0 check (price >= 0)
);

create index if not exists construction_change_costing_rows_revision_idx
  on public.construction_change_costing_rows (revision_id, line_order);

alter table public.construction_change_requests
  add constraint construction_change_requests_active_revision_fkey
  foreign key (active_costing_revision_id)
  references public.construction_change_costing_revisions (id) on delete set null;

create table if not exists public.construction_change_audit_events (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.construction_change_requests (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'status_change', 'approval', 'rejection', 'override',
      'costing_revision', 'customer_accept', 'customer_reject', 'comment'
    )
  ),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  comments text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists construction_change_audit_request_idx
  on public.construction_change_audit_events (change_request_id, created_at);

create table if not exists public.construction_change_customer_decisions (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.construction_change_requests (id) on delete cascade,
  revision_id uuid not null references public.construction_change_costing_revisions (id) on delete restrict,
  decision text not null check (decision in ('accepted', 'rejected')),
  confirmation_text text not null,
  user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Request number sequence per project
create or replace function public.next_change_request_number(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
  proj_name text;
begin
  select count(*) + 1 into seq
  from public.construction_change_requests
  where project_id = p_project_id;

  select left(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'), 6) into proj_name
  from public.projects where id = p_project_id;

  if proj_name is null or proj_name = '' then
    proj_name := 'PRJ';
  end if;

  return 'CCR-' || upper(proj_name) || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- updated_at trigger
drop trigger if exists construction_change_requests_updated_at on public.construction_change_requests;
create trigger construction_change_requests_updated_at
  before update on public.construction_change_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.construction_change_requests enable row level security;
alter table public.construction_change_request_attachments enable row level security;
alter table public.construction_change_costing_revisions enable row level security;
alter table public.construction_change_costing_rows enable row level security;
alter table public.construction_change_audit_events enable row level security;
alter table public.construction_change_customer_decisions enable row level security;

-- change requests
drop policy if exists "Admins manage change requests" on public.construction_change_requests;
create policy "Admins manage change requests"
  on public.construction_change_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage change requests on assigned projects" on public.construction_change_requests;
create policy "PMs manage change requests on assigned projects"
  on public.construction_change_requests for all to authenticated
  using (public.is_pm_for_project(project_id))
  with check (public.is_pm_for_project(project_id));

drop policy if exists "Engineers evaluate change requests on assigned projects" on public.construction_change_requests;
create policy "Engineers evaluate change requests on assigned projects"
  on public.construction_change_requests for all to authenticated
  using (
    public.is_engineer_for_project(project_id)
    and status not in ('draft')
  )
  with check (public.is_engineer_for_project(project_id));

drop policy if exists "Customers manage own draft/submitted change requests" on public.construction_change_requests;
create policy "Customers manage own draft/submitted change requests"
  on public.construction_change_requests for all to authenticated
  using (
    public.is_customer_for_project(project_id)
    and customer_id = auth.uid()
  )
  with check (
    public.is_customer_for_project(project_id)
    and customer_id = auth.uid()
  );

drop policy if exists "Customers view own change requests" on public.construction_change_requests;
create policy "Customers view own change requests"
  on public.construction_change_requests for select to authenticated
  using (
    public.is_customer_for_project(project_id)
    and customer_id = auth.uid()
  );

-- attachments
drop policy if exists "Admins manage change request attachments" on public.construction_change_request_attachments;
create policy "Admins manage change request attachments"
  on public.construction_change_request_attachments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage change attachments on assigned projects" on public.construction_change_request_attachments;
create policy "PMs manage change attachments on assigned projects"
  on public.construction_change_request_attachments for all to authenticated
  using (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id and public.is_pm_for_project(r.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id and public.is_pm_for_project(r.project_id)
    )
  );

drop policy if exists "Engineers manage internal attachments on assigned projects" on public.construction_change_request_attachments;
create policy "Engineers manage internal attachments on assigned projects"
  on public.construction_change_request_attachments for all to authenticated
  using (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and public.is_engineer_for_project(r.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and public.is_engineer_for_project(r.project_id)
    )
  );

drop policy if exists "Customers manage customer attachments on own requests" on public.construction_change_request_attachments;
create policy "Customers manage customer attachments on own requests"
  on public.construction_change_request_attachments for all to authenticated
  using (
    visibility = 'customer'
    and exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and r.customer_id = auth.uid()
        and public.is_customer_for_project(r.project_id)
    )
  )
  with check (
    visibility = 'customer'
    and exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and r.customer_id = auth.uid()
        and public.is_customer_for_project(r.project_id)
    )
  );

drop policy if exists "Customers view customer-visible attachments" on public.construction_change_request_attachments;
create policy "Customers view customer-visible attachments"
  on public.construction_change_request_attachments for select to authenticated
  using (
    visibility = 'customer'
    and exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and r.customer_id = auth.uid()
    )
  );

-- costing revisions (staff write; customers read when sent for approval)
drop policy if exists "Admins manage costing revisions" on public.construction_change_costing_revisions;
create policy "Admins manage costing revisions"
  on public.construction_change_costing_revisions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage costing revisions on assigned projects" on public.construction_change_costing_revisions;
create policy "PMs manage costing revisions on assigned projects"
  on public.construction_change_costing_revisions for all to authenticated
  using (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id and public.is_pm_for_project(r.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id and public.is_pm_for_project(r.project_id)
    )
  );

drop policy if exists "Engineers manage costing revisions on assigned projects" on public.construction_change_costing_revisions;
create policy "Engineers manage costing revisions on assigned projects"
  on public.construction_change_costing_revisions for all to authenticated
  using (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and public.is_engineer_for_project(r.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and public.is_engineer_for_project(r.project_id)
    )
  );

drop policy if exists "Customers view costing revisions when pending approval" on public.construction_change_costing_revisions;
create policy "Customers view costing revisions when pending approval"
  on public.construction_change_costing_revisions for select to authenticated
  using (
    exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and r.customer_id = auth.uid()
        and r.status in (
          'customer_approval_pending', 'approved', 'scheduled',
          'in_progress', 'completed'
        )
    )
  );

-- costing rows (mirror revision policies via join)
drop policy if exists "Staff manage costing rows" on public.construction_change_costing_rows;
create policy "Staff manage costing rows"
  on public.construction_change_costing_rows for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.construction_change_costing_revisions rev
      join public.construction_change_requests r on r.id = rev.change_request_id
      where rev.id = revision_id
        and (
          public.is_pm_for_project(r.project_id)
          or public.is_engineer_for_project(r.project_id)
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.construction_change_costing_revisions rev
      join public.construction_change_requests r on r.id = rev.change_request_id
      where rev.id = revision_id
        and (
          public.is_pm_for_project(r.project_id)
          or public.is_engineer_for_project(r.project_id)
        )
    )
  );

drop policy if exists "Customers view costing rows when visible" on public.construction_change_costing_rows;
create policy "Customers view costing rows when visible"
  on public.construction_change_costing_rows for select to authenticated
  using (
    exists (
      select 1 from public.construction_change_costing_revisions rev
      join public.construction_change_requests r on r.id = rev.change_request_id
      where rev.id = revision_id
        and r.customer_id = auth.uid()
        and r.status in (
          'customer_approval_pending', 'approved', 'scheduled',
          'in_progress', 'completed'
        )
    )
  );

-- audit events
drop policy if exists "Staff read audit events" on public.construction_change_audit_events;
create policy "Staff read audit events"
  on public.construction_change_audit_events for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and (
          public.is_pm_for_project(r.project_id)
          or public.is_engineer_for_project(r.project_id)
        )
    )
  );

drop policy if exists "Staff insert audit events" on public.construction_change_audit_events;
create policy "Staff insert audit events"
  on public.construction_change_audit_events for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and (
          public.is_pm_for_project(r.project_id)
          or public.is_engineer_for_project(r.project_id)
        )
    )
  );

drop policy if exists "Customers read limited audit on own requests" on public.construction_change_audit_events;
create policy "Customers read limited audit on own requests"
  on public.construction_change_audit_events for select to authenticated
  using (
    event_type in ('status_change', 'customer_accept', 'customer_reject')
    and exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id and r.customer_id = auth.uid()
    )
  );

drop policy if exists "Customers insert customer decisions audit" on public.construction_change_audit_events;
create policy "Customers insert customer decisions audit"
  on public.construction_change_audit_events for insert to authenticated
  with check (
    event_type in ('customer_accept', 'customer_reject')
    and actor_id = auth.uid()
    and exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id and r.customer_id = auth.uid()
    )
  );

-- customer decisions
drop policy if exists "Customers insert own decisions" on public.construction_change_customer_decisions;
create policy "Customers insert own decisions"
  on public.construction_change_customer_decisions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id and r.customer_id = auth.uid()
    )
  );

drop policy if exists "Customers view own decisions" on public.construction_change_customer_decisions;
create policy "Customers view own decisions"
  on public.construction_change_customer_decisions for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and public.is_pm_for_project(r.project_id)
    )
  );

drop policy if exists "Staff view customer decisions" on public.construction_change_customer_decisions;
create policy "Staff view customer decisions"
  on public.construction_change_customer_decisions for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.construction_change_requests r
      where r.id = change_request_id
        and (
          public.is_pm_for_project(r.project_id)
          or public.is_engineer_for_project(r.project_id)
        )
    )
  );

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'construction-change-files',
  'construction-change-files',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do nothing;

drop policy if exists "Staff upload construction change files" on storage.objects;
create policy "Staff upload construction change files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'construction-change-files'
    and (
      public.is_admin()
      or exists (
        select 1 from public.construction_change_requests r
        where r.id::text = (storage.foldername(name))[1]
          and (
            public.is_pm_for_project(r.project_id)
            or public.is_engineer_for_project(r.project_id)
          )
      )
    )
  );

drop policy if exists "Customers upload construction change files" on storage.objects;
create policy "Customers upload construction change files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'construction-change-files'
    and exists (
      select 1 from public.construction_change_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.customer_id = auth.uid()
        and public.is_customer_for_project(r.project_id)
    )
  );

drop policy if exists "Staff read construction change files" on storage.objects;
create policy "Staff read construction change files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'construction-change-files'
    and (
      public.is_admin()
      or exists (
        select 1 from public.construction_change_requests r
        where r.id::text = (storage.foldername(name))[1]
          and (
            public.is_pm_for_project(r.project_id)
            or public.is_engineer_for_project(r.project_id)
          )
      )
    )
  );

drop policy if exists "Customers read own construction change files" on storage.objects;
create policy "Customers read own construction change files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'construction-change-files'
    and exists (
      select 1 from public.construction_change_requests r
      join public.construction_change_request_attachments a
        on a.change_request_id = r.id
      where r.customer_id = auth.uid()
        and a.visibility = 'customer'
        and a.file_path = name
    )
  );

drop policy if exists "Staff delete construction change files" on storage.objects;
create policy "Staff delete construction change files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'construction-change-files'
    and (
      public.is_admin()
      or exists (
        select 1 from public.construction_change_requests r
        where r.id::text = (storage.foldername(name))[1]
          and public.is_pm_for_project(r.project_id)
      )
    )
  );

-- Allow engineers to insert notifications (for change request workflow via server)
drop policy if exists "Engineers create notifications" on public.notifications;
create policy "Engineers create notifications"
  on public.notifications for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'engineer'
    )
  );
