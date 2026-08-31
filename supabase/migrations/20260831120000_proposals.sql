-- VRA HOMES — Client quotation / proposal system
-- Shared versions are immutable commercial records.

-- ---------------------------------------------------------------------------
-- Company default notes (copied onto each new version; later edits do not
-- rewrite existing proposals)
-- ---------------------------------------------------------------------------
alter table public.company_settings
  add column if not exists proposal_default_notes text;

-- ---------------------------------------------------------------------------
-- Proposals
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  proposal_number text not null unique,
  title text not null,
  current_version_id uuid,
  status text not null default 'draft' check (
    status in (
      'draft',
      'shared',
      'viewed',
      'revision_requested',
      'revision_created',
      'accepted',
      'withdrawn',
      'expired',
      'archived'
    )
  ),
  share_token text unique,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_project_idx
  on public.proposals (project_id, created_at desc);

create index if not exists proposals_status_idx
  on public.proposals (status, updated_at desc);

create index if not exists proposals_share_token_idx
  on public.proposals (share_token)
  where share_token is not null;

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  method text not null check (method in ('sqft', 'boq')),
  status text not null default 'draft' check (
    status in (
      'draft',
      'shared',
      'viewed',
      'revision_requested',
      'superseded',
      'accepted',
      'withdrawn',
      'expired'
    )
  ),
  title text not null default '',
  proposal_date date not null default current_date,
  valid_until date,
  notes text not null default '',
  built_up_total numeric(14, 2) not null default 0,
  additional_works_total numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  snapshot_project_name text not null default '',
  snapshot_client_name text not null default '',
  snapshot_project_address text not null default '',
  snapshot_client_phone text,
  snapshot_client_email text,
  public_token text unique,
  shared_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, version_number)
);

create index if not exists proposal_versions_proposal_idx
  on public.proposal_versions (proposal_id, version_number desc);

create index if not exists proposal_versions_public_token_idx
  on public.proposal_versions (public_token)
  where public_token is not null;

alter table public.proposals
  drop constraint if exists proposals_current_version_id_fkey;

alter table public.proposals
  add constraint proposals_current_version_id_fkey
  foreign key (current_version_id)
  references public.proposal_versions (id)
  on delete set null;

create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_version_id uuid not null references public.proposal_versions (id) on delete cascade,
  section text not null check (section in ('built_up', 'additional', 'boq')),
  sort_order integer not null default 0,
  description text not null,
  quantity numeric(14, 4) not null default 0,
  unit text not null,
  rate numeric(14, 2) not null default 0,
  price numeric(14, 2) not null default 0
);

create index if not exists proposal_items_version_idx
  on public.proposal_items (proposal_version_id, section, sort_order);

create table if not exists public.proposal_revision_requests (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions (id) on delete cascade,
  client_message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create index if not exists proposal_revision_requests_version_idx
  on public.proposal_revision_requests (proposal_version_id, created_at desc);

create index if not exists proposal_revision_requests_open_idx
  on public.proposal_revision_requests (proposal_id, status)
  where status = 'open';

create table if not exists public.proposal_audit_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  proposal_version_id uuid references public.proposal_versions (id) on delete set null,
  event_type text not null check (
    event_type in (
      'created',
      'edited',
      'shared',
      'viewed',
      'revision_requested',
      'revision_created',
      'revision_shared',
      'withdrawn',
      'archived',
      'accepted'
    )
  ),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists proposal_audit_events_proposal_idx
  on public.proposal_audit_events (proposal_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------
create sequence if not exists public.proposal_number_seq;

create or replace function public.next_proposal_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  seq := nextval('public.proposal_number_seq')::integer;
  return 'VRA-' || lpad(seq::text, 3, '0');
end;
$$;

grant execute on function public.next_proposal_number() to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists proposals_updated_at on public.proposals;
create trigger proposals_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

drop trigger if exists proposal_versions_updated_at on public.proposal_versions;
create trigger proposal_versions_updated_at
  before update on public.proposal_versions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutability: shared versions cannot have commercial fields rewritten
-- ---------------------------------------------------------------------------
create or replace function public.proposal_versions_protect_shared()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.shared_at is not null then
      raise exception 'Shared proposal versions cannot be deleted';
    end if;
    return old;
  end if;

  if old.shared_at is null then
    return new;
  end if;

  if
    new.proposal_id is distinct from old.proposal_id
    or new.version_number is distinct from old.version_number
    or new.method is distinct from old.method
    or new.title is distinct from old.title
    or new.proposal_date is distinct from old.proposal_date
    or new.valid_until is distinct from old.valid_until
    or new.notes is distinct from old.notes
    or new.built_up_total is distinct from old.built_up_total
    or new.additional_works_total is distinct from old.additional_works_total
    or new.grand_total is distinct from old.grand_total
    or new.snapshot_project_name is distinct from old.snapshot_project_name
    or new.snapshot_client_name is distinct from old.snapshot_client_name
    or new.snapshot_project_address is distinct from old.snapshot_project_address
    or new.snapshot_client_phone is distinct from old.snapshot_client_phone
    or new.snapshot_client_email is distinct from old.snapshot_client_email
    or (old.public_token is not null and new.public_token is distinct from old.public_token)
    or (old.shared_at is not null and new.shared_at is distinct from old.shared_at)
    or new.created_by is distinct from old.created_by
  then
    raise exception 'Shared proposal versions are immutable commercial records';
  end if;

  return new;
end;
$$;

drop trigger if exists proposal_versions_protect_shared on public.proposal_versions;
create trigger proposal_versions_protect_shared
  before update or delete on public.proposal_versions
  for each row execute function public.proposal_versions_protect_shared();

create or replace function public.proposal_items_protect_shared()
returns trigger
language plpgsql
as $$
declare
  shared timestamptz;
  version_id uuid;
begin
  version_id := coalesce(new.proposal_version_id, old.proposal_version_id);

  select shared_at into shared
  from public.proposal_versions
  where id = version_id;

  if shared is not null then
    raise exception 'Shared proposal versions cannot have their items changed';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_items_protect_shared on public.proposal_items;
create trigger proposal_items_protect_shared
  before insert or update or delete on public.proposal_items
  for each row execute function public.proposal_items_protect_shared();

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------
create or replace function public.user_can_manage_proposal(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.proposals pr
    where pr.id = p_proposal_id
      and (
        public.is_admin()
        or public.is_pm_for_project(pr.project_id)
      )
  );
$$;

create or replace function public.user_can_manage_proposal_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_pm_for_project(p_project_id);
$$;

grant execute on function public.user_can_manage_proposal(uuid) to authenticated;
grant execute on function public.user_can_manage_proposal_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.proposals enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_items enable row level security;
alter table public.proposal_revision_requests enable row level security;
alter table public.proposal_audit_events enable row level security;

drop policy if exists "Admins manage proposals" on public.proposals;
create policy "Admins manage proposals"
  on public.proposals for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage proposals on assigned projects" on public.proposals;
create policy "PMs manage proposals on assigned projects"
  on public.proposals for all to authenticated
  using (public.is_pm_for_project(project_id))
  with check (public.is_pm_for_project(project_id));

drop policy if exists "Admins manage proposal versions" on public.proposal_versions;
create policy "Admins manage proposal versions"
  on public.proposal_versions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage proposal versions on assigned projects" on public.proposal_versions;
create policy "PMs manage proposal versions on assigned projects"
  on public.proposal_versions for all to authenticated
  using (public.user_can_manage_proposal(proposal_id))
  with check (public.user_can_manage_proposal(proposal_id));

drop policy if exists "Admins manage proposal items" on public.proposal_items;
create policy "Admins manage proposal items"
  on public.proposal_items for all to authenticated
  using (
    exists (
      select 1 from public.proposal_versions v
      where v.id = proposal_version_id and public.is_admin()
    )
  )
  with check (
    exists (
      select 1 from public.proposal_versions v
      where v.id = proposal_version_id and public.is_admin()
    )
  );

drop policy if exists "PMs manage proposal items on assigned projects" on public.proposal_items;
create policy "PMs manage proposal items on assigned projects"
  on public.proposal_items for all to authenticated
  using (
    exists (
      select 1 from public.proposal_versions v
      where v.id = proposal_version_id
        and public.user_can_manage_proposal(v.proposal_id)
    )
  )
  with check (
    exists (
      select 1 from public.proposal_versions v
      where v.id = proposal_version_id
        and public.user_can_manage_proposal(v.proposal_id)
    )
  );

drop policy if exists "Admins manage proposal revision requests" on public.proposal_revision_requests;
create policy "Admins manage proposal revision requests"
  on public.proposal_revision_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage proposal revision requests on assigned projects" on public.proposal_revision_requests;
create policy "PMs manage proposal revision requests on assigned projects"
  on public.proposal_revision_requests for all to authenticated
  using (public.user_can_manage_proposal(proposal_id))
  with check (public.user_can_manage_proposal(proposal_id));

drop policy if exists "Admins manage proposal audit events" on public.proposal_audit_events;
create policy "Admins manage proposal audit events"
  on public.proposal_audit_events for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage proposal audit events on assigned projects" on public.proposal_audit_events;
create policy "PMs manage proposal audit events on assigned projects"
  on public.proposal_audit_events for all to authenticated
  using (public.user_can_manage_proposal(proposal_id))
  with check (public.user_can_manage_proposal(proposal_id));
