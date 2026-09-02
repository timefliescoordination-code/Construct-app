-- Group headings and optional takeoff dimensions on proposal BOQ lines.

alter table public.proposal_items
  add column if not exists kind text not null default 'item';

alter table public.proposal_items
  drop constraint if exists proposal_items_kind_check;

alter table public.proposal_items
  add constraint proposal_items_kind_check
  check (kind in ('heading', 'item'));

alter table public.proposal_items
  add column if not exists measurements jsonb;

comment on column public.proposal_items.kind is
  'heading = group title with no billed quantity; item = billed line';

comment on column public.proposal_items.measurements is
  'Optional takeoff dimensions { nos, length, breadth, height } for BOQ rows';

alter table public.proposal_items
  add column if not exists nested boolean not null default false;

comment on column public.proposal_items.nested is
  'True when the billed line belongs under the previous heading';
