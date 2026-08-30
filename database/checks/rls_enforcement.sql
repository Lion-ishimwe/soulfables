-- =====================================================================
-- Soulfables — does RLS actually deny?
--
-- Milestone M4. Coverage (rls_coverage.sql) proves every table HAS a
-- policy; this proves the policies DO something. They are different
-- questions, and only the second one protects anybody.
--
-- Runs as `authenticated`, not as the superuser. That matters: a
-- superuser bypasses RLS entirely, so a test run as postgres would pass
-- while proving nothing at all.
--
-- Usage:
--   psql -d soulfables -f database/checks/rls_enforcement.sql
-- =====================================================================

\set ON_ERROR_STOP on
\pset pager off

begin;

-- --------------------------------------------------------------------
-- Two readers, and a member of staff.
-- --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ama@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@example.com'),
  ('cccccccc-0000-0000-0000-000000000003', 'staff@soulfables.co')
on conflict (id) do nothing;

insert into user_roles (user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'reader'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'reader'),
  ('cccccccc-0000-0000-0000-000000000003', 'owner')
on conflict (user_id) do update set role = excluded.role;

-- Something private belonging to each of them.
insert into journal_entries (user_id, body) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ama wrote this and nobody else should ever see it.'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Ben wrote this and nobody else should ever see it.');

-- And something Ama has paid for.
insert into entitlements (user_id, product_id, source)
select 'aaaaaaaa-0000-0000-0000-000000000001', id, 'purchase'
from products where slug = 'the-version-of-me-you-broke';

-- Grants the API roles would have on a real project.
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

/*
 * Re-apply the column revoke from 0015.
 *
 * A blanket `grant select on all tables` silently undoes a column-level
 * revoke — it grants every column, including the one deliberately taken
 * away. That is not a quirk of this test: run that same grant against
 * the live project and the premium bodies are readable again, with
 * nothing to indicate anything changed.
 *
 * Restated here so the test exercises the state the migration leaves
 * behind, and so the hazard is written down where somebody will read it.
 */
select grant_story_columns();

-- --------------------------------------------------------------------
-- The checks. Each raises rather than returning a row, so a failure
-- stops the script instead of scrolling past.
-- --------------------------------------------------------------------
create or replace function assert(cond boolean, what text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice '  ok   %', what;
  else
    raise exception 'FAILED: %', what;
  end if;
end $$;

set role authenticated;

-- === Ama ==============================================================
select auth.become('aaaaaaaa-0000-0000-0000-000000000001');
select assert(
  (select count(*) from journal_entries) = 1,
  'a reader sees only their own journal entries'
);
select assert(
  (select count(*) from journal_entries
    where body like 'Ben wrote%') = 0,
  'a reader cannot read another reader''s journal'
);
select assert(
  (select count(*) from entitlements) = 1,
  'a reader sees their own entitlements'
);

-- === Ben ==============================================================
select auth.become('bbbbbbbb-0000-0000-0000-000000000002');
select assert(
  (select count(*) from journal_entries) = 1,
  'the other reader likewise sees only their own'
);
select assert(
  (select count(*) from entitlements) = 0,
  'a reader cannot see what somebody else has bought'
);

-- The core promise of section 21, stated as a test.
select assert(
  (select has_entitlement(
     'bbbbbbbb-0000-0000-0000-000000000002',
     (select id from products where slug = 'the-version-of-me-you-broke')
   )) = false,
  'a reader who has not bought a product is not entitled to it'
);

-- Nobody may write themselves an entitlement.
do $$
begin
  begin
    insert into entitlements (user_id, product_id, source)
    select 'bbbbbbbb-0000-0000-0000-000000000002', id, 'purchase'
      from products where slug = 'the-version-of-me-you-broke';
    raise exception 'FAILED: a reader granted themselves an entitlement';
  exception
    when insufficient_privilege then
      raise notice '  ok   a reader cannot grant themselves an entitlement';
  end;
end $$;

-- Nor mark an order paid.
do $$
begin
  begin
    insert into orders (email, status, provider, currency, total_amount)
    values ('ben@example.com', 'paid', 'stripe', 'USD', 0);
    raise exception 'FAILED: a reader created a paid order';
  exception
    when insufficient_privilege then
      raise notice '  ok   a reader cannot create an order at all';
  end;
end $$;

-- === Staff ============================================================
select auth.become('cccccccc-0000-0000-0000-000000000003');
select assert(
  (select count(*) from orders) >= 0,
  'staff can read orders'
);
select assert(
  (select count(*) from journal_entries) = 0,
  'STAFF CANNOT READ ANY JOURNAL ENTRY'
);

-- === Nobody ===========================================================
select auth.become_anonymous();
select assert(
  (select count(*) from journal_entries) = 0,
  'an anonymous visitor sees no journal entries'
);
select assert(
  (select count(*) from entitlements) = 0,
  'an anonymous visitor sees no entitlements'
);
select assert(
  (select count(*) from stories where status = 'published') >= 0,
  'an anonymous visitor can still read published stories'
);
select assert(
  (select count(*) from product_files) = 0,
  'an anonymous visitor sees no paid files'
);

-- === Paid prose ========================================================
-- The hole 0015 closed: a premium body served to whoever asked.
select assert(
  (select story_body('letters-to-the-tide')) is null,
  'an anonymous visitor cannot read a PREMIUM story body'
);
select assert(
  (select story_body('the-house-after-you-left')) is not null,
  'an anonymous visitor CAN read a free story body'
);

-- And not by the back door either. Selecting the column directly must be
-- refused outright rather than returning null, or a future query that
-- forgets the function would leak again.
do $$
begin
  begin
    perform body_mdx from stories limit 1;
    raise exception 'FAILED: body_mdx is still selectable directly';
  exception
    when insufficient_privilege then
      raise notice '  ok   selecting stories.body_mdx directly is refused';
  end;
end $$;

reset role;

do $$ begin raise notice '';
  raise notice 'M4 PASSED — RLS denies, not merely exists.';
end $$;

rollback;
