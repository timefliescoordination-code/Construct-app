-- Engineer site photo uploads + company watermark metadata on photos

alter table public.project_site_photos
  add column if not exists company_name text,
  add column if not exists company_phone text;

drop policy if exists "Engineers view site photos on assigned projects" on public.project_site_photos;

drop policy if exists "Engineers manage site photos on assigned projects" on public.project_site_photos;
create policy "Engineers manage site photos on assigned projects"
  on public.project_site_photos for all to authenticated
  using (
    public.current_user_role() = 'engineer'
    and public.is_engineer_for_project(project_id)
  )
  with check (
    public.current_user_role() = 'engineer'
    and public.is_engineer_for_project(project_id)
  );

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
      or public.is_engineer_for_project(((storage.foldername(name))[1])::uuid)
    )
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
      or public.is_engineer_for_project(((storage.foldername(name))[1])::uuid)
    )
  );
