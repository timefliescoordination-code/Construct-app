-- Link open split expense groups to vendor pending on Payments tab
-- Run after expense-splits-module.sql

alter table public.vendor_payments
  add column if not exists expense_split_group_id uuid references public.expense_split_groups (id) on delete cascade;

create unique index if not exists vendor_payments_expense_split_group_idx
  on public.vendor_payments (expense_split_group_id)
  where expense_split_group_id is not null;

notify pgrst, 'reload schema';
