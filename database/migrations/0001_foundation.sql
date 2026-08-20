-- =====================================================================
-- Soulfables — 0001 Foundation
-- Extensions, enums, shared helper functions, and audit plumbing.
-- Everything later depends on this file. Run it first.
-- =====================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fuzzy search on titles
create extension if not exists "unaccent";      -- accent-insensitive search
create extension if not exists "vector";        -- pgvector, for the Intelligence layer

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

-- Role lookup used by nearly every RLS policy.
-- SECURITY DEFINER + a locked search_path so policies can call it without
-- granting readers direct select on user_roles.
create or replace function auth_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from user_roles where user_id = auth.uid()),
    'reader'::app_role
  );
$$;

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() in ('editor', 'admin', 'owner');
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() in ('admin', 'owner');
$$;

-- Slugify: used by seed scripts and admin helpers so slugs stay predictable.
create or replace function slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(unaccent(input)), '[^a-z0-9]+', '-', 'g'));
$$;
