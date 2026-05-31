-- Remove Material Intelligence schema (run in Supabase SQL Editor)
-- Safe when MI was never installed: uses IF EXISTS throughout.

drop table if exists public.material_mapping_reviews cascade;
drop table if exists public.material_purchases cascade;
drop table if exists public.material_aliases cascade;
drop table if exists public.material_master cascade;

drop function if exists public.material_master_track_rate_change() cascade;

alter table if exists public.invoice_items
  drop constraint if exists invoice_items_material_id_fkey;

drop index if exists public.invoice_items_material_id_idx;

alter table if exists public.invoice_items
  drop column if exists material_id;

alter table if exists public.expenses
  drop column if exists material_rate_warning;

notify pgrst, 'reload schema';
