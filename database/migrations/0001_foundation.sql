-- =====================================================================
-- Soulfables — 0001 Foundation
-- Extensions, enums, shared helper functions, and audit plumbing.
-- Everything later depends on this file. Run it first.
-- =====================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fuzzy search on titles
create extension if not exists "unaccent";      -- accent-insensitive search
-- pgvector powers the Intelligence layer (brief §14). It is genuinely
-- optional: the embedding column and its index are created only if the
-- extension is available, so the schema applies cleanly on a Postgres
-- without it and the feature switches on later without a migration.
do $ext$
begin
  create extension if not exists "vector";
exception when others then
  raise notice 'pgvector unavailable — embeddings will be skipped';
end
$ext$;

-- ---------------------------------------------------------------------
-- Enums
-- Kept deliberately small. Anything the editorial team needs to add on
-- their own (shelves, themes, moods, categories) is a TABLE, not an enum,
-- so the admin dashboard can extend it without a migration.
-- ---------------------------------------------------------------------

create type app_role as enum ('reader', 'editor', 'admin', 'owner');

create type publish_status as enum ('draft', 'in_review', 'scheduled', 'published', 'archived');

create type access_level as enum ('free', 'premium');

create type product_kind as enum ('ebook', 'anthology', 'journal', 'deck', 'audio', 'bundle');

create type file_format as enum ('epub', 'pdf', 'mobi', 'mp3', 'm4b', 'zip');

create type order_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded');

create type entitlement_source as enum ('purchase', 'subscription', 'gift', 'manual', 'promotional');

create type subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'paused');

create type subscriber_status as enum ('pending', 'confirmed', 'unsubscribed', 'bounced');

create type entry_visibility as enum ('private', 'unlisted', 'shared');

-- Direction of travel between shelves; see shelf_journeys.
create type journey_direction as enum ('arrives_from', 'continues_to');

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

-- Keeps updated_at honest without relying on the application layer.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- NOTE: auth_role(), is_staff() and is_admin() are defined in 0002,
-- not here. Postgres validates SQL function bodies at creation, and those
-- three read user_roles — which does not exist until 0002. Defining them
-- here would make this migration unapplicable to a clean database.

-- Slugify: used by seed scripts and admin helpers so slugs stay predictable.
create or replace function slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(unaccent(input)), '[^a-z0-9]+', '-', 'g'));
$$;
