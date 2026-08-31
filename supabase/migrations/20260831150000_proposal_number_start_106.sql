-- Start new quotation numbers at VRA-106.
-- Existing rows such as VRA-001 are left unchanged.

do $$
declare
  max_existing integer;
begin
  select coalesce(
    max((regexp_replace(proposal_number, '\D', '', 'g'))::integer),
    0
  )
  into max_existing
  from public.proposals
  where proposal_number ~ '^VRA-[0-9]+';

  perform setval(
    'public.proposal_number_seq',
    greatest(105, max_existing),
    true
  );
end
$$;
