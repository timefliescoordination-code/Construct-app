-- Tag site photos with construction stage from latest expense milestone

alter table public.project_site_photos
  add column if not exists milestone_id uuid references public.milestones (id) on delete set null,
  add column if not exists stage_label text;

create index if not exists project_site_photos_project_stage_idx
  on public.project_site_photos (project_id, stage_label, created_at desc);
