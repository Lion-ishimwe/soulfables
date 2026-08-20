-- =====================================================================
-- Soulfables — 0013 Order references
--
-- Human-facing order numbers: SF-2026-0001.
--
-- Generated in the database rather than the application for two reasons:
-- a sequence cannot collide under concurrency, and a customer support
-- conversation needs a number that is short enough to read aloud over a
-- phone. A UUID is neither.
-- =====================================================================

create sequence if not exists order_reference_seq;

create or replace function next_order_reference()
returns text
language sql
volatile
as $func$
  select 'SF-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('order_reference_seq')::text, 4, '0');
$func$;

-- Backfill anything created before this migration.
update orders
   set reference = next_order_reference()
 where reference is null or reference = '';

alter table orders
  alter column reference set default next_order_reference();
