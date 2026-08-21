-- =====================================================================
-- Soulfables — 0002 Identity
-- Profiles, roles, and reader preferences.
-- auth.users is owned by Supabase Auth; we never write to it directly.
-- =====================================================================

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  handle        text unique,
  avatar_url    text,
  bio           text,
  timezone      text not null default 'UTC',
  -- Marketing consent is tracked separately from the transactional
  -- relationship; unsubscribing from the Letter must never break receipts.
  marketing_opt_in boolean not null default false,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Roles live in their own table rather than on profiles so that a
-- compromised profile update can never escalate privilege.
create table user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       app_role not null default 'reader',
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);

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

-- Reader-facing preferences. Mirrored into the mobile app via the same API.
create table user_settings (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  reader_theme      text not null default 'night',      -- night | ivory | sepia
  reader_font       text not null default 'serif',      -- serif | sans
  reader_font_scale numeric(3,2) not null default 1.00, -- 0.80 .. 1.60
  reader_line_height numeric(3,2) not null default 1.70,
  autoplay_audio    boolean not null default false,
  email_receipts    boolean not null default true,
  email_weekly_letter boolean not null default false,
  -- Explicit, revocable consent for the AI companion to read journal
  -- entries. Default false: "private by default" has to survive the AI.
  ai_may_read_journal boolean not null default false,
  updated_at        timestamptz not null default now(),
  constraint reader_font_scale_range check (reader_font_scale between 0.80 and 2.00)
);

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

-- Provision profile + settings + default role on signup.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into user_settings (user_id) values (new.id);
  insert into user_roles (user_id, role) values (new.id, 'reader');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create index profiles_handle_idx on profiles (handle);
