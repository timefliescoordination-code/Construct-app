alter table public.proposal_items
  add column if not exists nested boolean not null default false;

comment on column public.proposal_items.nested is
  'True when the billed line belongs under the previous heading';
