-- Admin-visible passwords for user management
-- Run in Supabase Dashboard → SQL Editor

create table if not exists public.user_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_credentials enable row level security;

drop policy if exists "Admins can manage user credentials" on public.user_credentials;
create policy "Admins can manage user credentials"
  on public.user_credentials for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
