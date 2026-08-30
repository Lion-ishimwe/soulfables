-- =====================================================================
-- Supabase shim, for a plain PostgreSQL server
--
-- The migrations reference things a hosted Supabase project provides and
-- a bare Postgres does not: the `auth` and `storage` schemas, the three
-- API roles, and auth.uid(). This stands up just enough of that for the
-- schema to apply and for RLS to be exercised locally.
--
-- It is NOT a Supabase emulator and does not pretend to be. There is no
-- PostgREST, no GoTrue, no Storage API — so the application still cannot
-- talk to this database. What it gives is the thing that mattered most
-- and had never been done: proving the migrations apply to a real
-- server, and that the RLS policies actually deny.
--
-- `request.jwt.claims` is how Supabase passes the signed-in user to
-- Postgres, and auth.uid() reads it. Setting that GUC by hand is what
-- lets a test become a specific reader.
-- =====================================================================

create schema if not exists auth;
create schema if not exists storage;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create table if not exists storage.buckets (
  id                 text primary key,
  name               text,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

/*
 * The real one. Reads the JWT claims Supabase sets per request; returns
 * null when nobody is signed in, which is what makes the anonymous case
 * testable.
 */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  -- The inner nullif matters: when nobody is signed in the GUC is the
  -- empty string, and ''::jsonb is a syntax error rather than null. Real
  -- Supabase handles that; a naive shim does not, and every anonymous
  -- request would fail instead of simply seeing nothing.
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    ),
    'anon'
  );
$$;

/** Convenience for tests: become a given user for the session. */
create or replace function auth.become(p_user uuid)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    false
  );
$$;

create or replace function auth.become_anonymous()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '', false);
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth, storage to anon, authenticated, service_role;
