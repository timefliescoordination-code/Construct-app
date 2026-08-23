-- Company profile (name, phone, logo, etc.) for admin branding and site-photo watermarks

create table if not exists public.company_settings (
  id text primary key default 'default' check (id = 'default'),
  company_name text,
  phone text,
  email text,
  address text,
  website text,
  logo_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.company_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.company_settings enable row level security;

drop policy if exists "Admins manage company settings" on public.company_settings;
create policy "Admins manage company settings"
  on public.company_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Staff read company settings" on public.company_settings;
create policy "Staff read company settings"
  on public.company_settings for select to authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Public read company assets" on storage.objects;
create policy "Public read company assets"
  on storage.objects for select to public
  using (bucket_id = 'company-assets');

drop policy if exists "Admins upload company assets" on storage.objects;
create policy "Admins upload company assets"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'company-assets' and public.is_admin());

drop policy if exists "Admins update company assets" on storage.objects;
create policy "Admins update company assets"
  on storage.objects for update to authenticated
  using (bucket_id = 'company-assets' and public.is_admin())
  with check (bucket_id = 'company-assets' and public.is_admin());

drop policy if exists "Admins delete company assets" on storage.objects;
create policy "Admins delete company assets"
  on storage.objects for delete to authenticated
  using (bucket_id = 'company-assets' and public.is_admin());
