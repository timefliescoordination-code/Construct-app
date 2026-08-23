-- Customer notification fields + site photo uploads

alter table public.notifications
  add column if not exists reference_id uuid,
  add column if not exists link_path text,
  add column if not exists dedupe_key text;

create unique index if not exists notifications_user_dedupe_key_uidx
  on public.notifications (user_id, dedupe_key);

create table if not exists public.project_site_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  upload_batch_id uuid not null,
  file_path text not null,
  file_name text not null,
  file_mime_type text not null,
  caption text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_site_photos_project_batch_idx
  on public.project_site_photos (project_id, upload_batch_id, created_at desc);

alter table public.project_site_photos enable row level security;

drop policy if exists "Admins manage project site photos" on public.project_site_photos;
create policy "Admins manage project site photos"
  on public.project_site_photos for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "PMs manage site photos on assigned projects" on public.project_site_photos;
create policy "PMs manage site photos on assigned projects"
  on public.project_site_photos for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.pm_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.pm_id = auth.uid()
    )
  );

drop policy if exists "Engineers view site photos on assigned projects" on public.project_site_photos;
create policy "Engineers view site photos on assigned projects"
  on public.project_site_photos for select to authenticated
  using (public.is_engineer_for_project(project_id));

drop policy if exists "Customers view site photos on assigned projects" on public.project_site_photos;
create policy "Customers view site photos on assigned projects"
  on public.project_site_photos for select to authenticated
  using (public.is_customer_for_project(project_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-site-photos',
  'project-site-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Staff upload project site photos" on storage.objects;
create policy "Staff upload project site photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-site-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.projects p
        where p.id::text = (storage.foldername(name))[1]
          and p.pm_id = auth.uid()
      )
    )
  );

drop policy if exists "Staff read project site photos" on storage.objects;
create policy "Staff read project site photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-site-photos'
    and (
      public.is_admin()
      or public.is_pm_for_project(((storage.foldername(name))[1])::uuid)
      or public.is_engineer_for_project(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "Customers read project site photos" on storage.objects;
create policy "Customers read project site photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-site-photos'
    and public.is_customer_for_project(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Staff delete project site photos" on storage.objects;
create policy "Staff delete project site photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-site-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.projects p
        where p.id::text = (storage.foldername(name))[1]
          and p.pm_id = auth.uid()
      )
    )
  );
