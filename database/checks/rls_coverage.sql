-- =====================================================================
-- RLS coverage check
--
-- Run in CI. Fails the build if any table in `public` either has RLS
-- disabled or has RLS enabled with no policy and no documented reason.
--
-- The second case matters as much as the first. A table with RLS on and
-- zero policies is reachable only by the service role — which is correct
-- for webhook_events and email_events, and a bug for anything a reader
-- is supposed to see. Listing the intentional ones here means a NEW
-- table that forgets its policies cannot slip through unnoticed.
-- =====================================================================

-- Tables that are deliberately service-role only.
create temporary table expected_service_role_only (name text primary key);
insert into expected_service_role_only (name) values
  ('webhook_events'),
  ('email_events'),
  -- Migration bookkeeping, created by database/scripts/remote.mjs rather
  -- than by a migration. RLS on with no policies denies everyone, and the
  -- grants are revoked so PostgREST will not offer it. Nobody but the
  -- migration runner has any business reading it.
  ('schema_migrations');

do $$
declare
  v_no_rls text[];
  v_no_policy text[];
begin
  -- 1. RLS switched off entirely.
  select array_agg(c.relname order by c.relname)
    into v_no_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_no_rls is not null then
    raise exception 'RLS DISABLED on: %', array_to_string(v_no_rls, ', ');
  end if;

  -- 2. RLS on, but no policies, and not on the expected list.
  select array_agg(t.tablename order by t.tablename)
    into v_no_policy
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tablename
    )
    and t.tablename not in (select name from expected_service_role_only);

  if v_no_policy is not null then
    raise exception
      'RLS enabled but NO POLICY on: %. Add policies, or add the table to expected_service_role_only in this file with a comment explaining why.',
      array_to_string(v_no_policy, ', ');
  end if;

  raise notice 'RLS coverage OK';
end $$;
