-- Design phase lifecycle, design file uploads, and comments

alter table public.projects
  add column if not exists lifecycle_phase text not null default 'design'
    check (lifecycle_phase in ('design', 'construction')),
  add column if not exists construction_activated_at timestamptz,
  add column if not exists construction_activated_by uuid references public.profiles (id) on delete set null,
  add column if not exists client_phone text;

-- Existing projects with milestones are already in construction
update public.projects p
set lifecycle_phase = 'construction'
where exists (
  select 1 from public.milestones m where m.project_id = p.id
);

create table if not exists public.project_design_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_mime_type text not null,
  title text not null default '',
  revision_label text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_design_files_project_id_idx
  on public.project_design_files (project_id, created_at desc);

create table if not exists public.project_design_comments (
  id uuid primary key default gen_random_uuid(),
  design_file_id uuid not null references public.project_design_files (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_design_comments_file_id_idx
  on public.project_design_comments (design_file_id, created_at asc);

alter table public.project_design_files enable row level security;
alter table public.project_design_comments enable row level security;

-- project_design_files policies
drop policy if exists "Admins manage project design files" on public.project_design_files;
create policy "Admins manage project design files"
  on public.project_design_files for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage design files on assigned projects" on public.project_design_files;
create policy "PMs manage design files on assigned projects"
  on public.project_design_files for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  )
  with check (
    public.current_user_role() = 'pm'
    and public.is_pm_for_project(project_id)
  );

drop policy if exists "Engineers view design files on assigned projects" on public.project_design_files;
create policy "Engineers view design files on assigned projects"
  on public.project_design_files for select to authenticated
  using (public.is_engineer_for_project(project_id));

drop policy if exists "Customers view design files on assigned projects" on public.project_design_files;
create policy "Customers view design files on assigned projects"
  on public.project_design_files for select to authenticated
  using (public.is_customer_for_project(project_id));

-- project_design_comments policies
drop policy if exists "Admins manage project design comments" on public.project_design_comments;
create policy "Admins manage project design comments"
  on public.project_design_comments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage design comments on assigned projects" on public.project_design_comments;
create policy "PMs manage design comments on assigned projects"
  on public.project_design_comments for all to authenticated
  using (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.project_design_files f
      where f.id = design_file_id and public.is_pm_for_project(f.project_id)
    )
  )
  with check (
    public.current_user_role() = 'pm'
    and exists (
      select 1 from public.project_design_files f
      where f.id = design_file_id and public.is_pm_for_project(f.project_id)
    )
  );

drop policy if exists "Engineers view design comments on assigned projects" on public.project_design_comments;
create policy "Engineers view design comments on assigned projects"
  on public.project_design_comments for select to authenticated
  using (
    exists (
      select 1 from public.project_design_files f
      where f.id = design_file_id and public.is_engineer_for_project(f.project_id)
    )
  );

drop policy if exists "Customers view design comments on assigned projects" on public.project_design_comments;
create policy "Customers view design comments on assigned projects"
  on public.project_design_comments for select to authenticated
  using (
    exists (
      select 1 from public.project_design_files f
      where f.id = design_file_id and public.is_customer_for_project(f.project_id)
    )
  );

drop policy if exists "Customers insert design comments on assigned projects" on public.project_design_comments;
create policy "Customers insert design comments on assigned projects"
  on public.project_design_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.project_design_files f
      where f.id = design_file_id and public.is_customer_for_project(f.project_id)
    )
  );

-- Storage bucket for design drawings
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-designs',
  'project-designs',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Staff upload project design files" on storage.objects;
create policy "Staff upload project design files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-designs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm')
    )
  );

drop policy if exists "Staff read project design files" on storage.objects;
create policy "Staff read project design files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-designs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm', 'engineer')
    )
  );

drop policy if exists "Customers read project design files" on storage.objects;
create policy "Customers read project design files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-designs'
    and public.is_customer_for_project(
      (split_part(name, '/', 1))::uuid
    )
  );

drop policy if exists "Staff update project design files" on storage.objects;
create policy "Staff update project design files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-designs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm')
    )
  );

drop policy if exists "Staff delete project design files" on storage.objects;
create policy "Staff delete project design files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-designs'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'pm')
    )
  );

notify pgrst, 'reload schema';
