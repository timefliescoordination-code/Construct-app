-- Telegram bot: link engineers to profiles and store conversation state

create table if not exists public.telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_chat_id bigint not null,
  telegram_username text,
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists telegram_accounts_profile_id_idx
  on public.telegram_accounts (profile_id);

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_codes_profile_id_idx
  on public.telegram_link_codes (profile_id);

create table if not exists public.telegram_sessions (
  telegram_chat_id bigint primary key,
  profile_id uuid references public.profiles (id) on delete set null,
  state text not null default 'idle',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists telegram_sessions_updated_at on public.telegram_sessions;
create trigger telegram_sessions_updated_at
  before update on public.telegram_sessions
  for each row execute function public.set_updated_at();

alter table public.telegram_accounts enable row level security;
alter table public.telegram_link_codes enable row level security;
alter table public.telegram_sessions enable row level security;

-- No policies: accessed only via service role from the Telegram webhook API.
