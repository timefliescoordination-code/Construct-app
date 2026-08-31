-- Proposals are independent of the project list until Admin/PM converts them.

alter table public.proposals
  alter column project_id drop not null;

alter table public.proposals
  add column if not exists proposed_project_name text not null default '',
  add column if not exists proposed_site_address text not null default '',
  add column if not exists proposed_client_name text not null default '',
  add column if not exists proposed_client_phone text,
  add column if not exists proposed_client_email text,
  add column if not exists converted_at timestamptz,
  add column if not exists converted_by uuid references public.profiles (id) on delete set null;

-- Existing linked rows were created against real projects.
update public.proposals p
set
  proposed_project_name = coalesce(nullif(btrim(p.proposed_project_name), ''), pr.name, ''),
  proposed_site_address = coalesce(nullif(btrim(p.proposed_site_address), ''), pr.site_address, ''),
  proposed_client_name = coalesce(nullif(btrim(p.proposed_client_name), ''), pr.client_name, ''),
  proposed_client_phone = coalesce(p.proposed_client_phone, pr.client_phone),
  converted_at = coalesce(p.converted_at, p.created_at),
  converted_by = coalesce(p.converted_by, p.created_by)
from public.projects pr
where p.project_id = pr.id;

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
        or (pr.project_id is not null and public.is_pm_for_project(pr.project_id))
        or (
          pr.project_id is null
          and pr.created_by = auth.uid()
          and public.current_user_role() = 'pm'
        )
      )
  );
$$;

drop policy if exists "PMs manage proposals on assigned projects" on public.proposals;
drop policy if exists "PMs manage standalone and assigned proposals" on public.proposals;
create policy "PMs manage standalone and assigned proposals"
  on public.proposals for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and (
      public.is_pm_for_project(project_id)
      or (project_id is null and created_by = auth.uid())
    )
  )
  with check (
    public.current_user_role() = 'pm'
    and (
      public.is_pm_for_project(project_id)
      or (project_id is null and created_by = auth.uid())
    )
  );

alter table public.proposal_audit_events
  drop constraint if exists proposal_audit_events_event_type_check;

alter table public.proposal_audit_events
  add constraint proposal_audit_events_event_type_check
  check (
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
      'accepted',
      'converted_to_project'
    )
  );
