-- =====================================================================
-- Soulfables — 0022 A backdrop the House can change
--
-- The front door's background is drawn in SVG (library-backdrop.tsx),
-- which is why it has never needed a file. It also means the only way to
-- change it has been to edit a component and deploy — so the one image
-- readers see first is the one thing the admin cannot touch.
--
-- featured_slots already answers "what should appear here"; it simply had
-- nowhere to put an image. A placement carrying a picture rather than a
-- story is the smallest addition that makes the backdrop editable.
-- =====================================================================

alter table featured_slots
  add column if not exists image_url text;

comment on column featured_slots.image_url is
  'For placements that carry a picture rather than an entity — the front door backdrop. Null everywhere else.';

/*
 * entity_id is required for a slot that points at a story or a product.
 * A backdrop points at nothing, so the constraint has to allow a slot
 * that carries only an image.
 */
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'featured_slots' and column_name = 'entity_id' and is_nullable = 'NO'
  ) then
    alter table featured_slots alter column entity_id drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'featured_slots' and column_name = 'entity_type' and is_nullable = 'NO'
  ) then
    alter table featured_slots alter column entity_type drop not null;
  end if;
end
$$;

-- A slot must carry something: an entity, or a picture.
alter table featured_slots
  drop constraint if exists featured_slots_carries_something;

alter table featured_slots
  add constraint featured_slots_carries_something
  check (entity_id is not null or image_url is not null);
