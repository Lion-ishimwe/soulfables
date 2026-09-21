-- =====================================================================
-- Soulfables — 0050 Push tokens
--
-- The mobile app asks the phone for a push token and hands it to the
-- House. One row per device; a reader may have several. The House uses
-- them to say that a new story is out, or that someone replied. A token
-- that stops working is deleted when the push service says so.
-- =====================================================================

create table if not exists push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table push_tokens is
  'Expo push tokens, one per device, for the mobile app. The reader owns their rows.';

create index if not exists push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

create policy push_tokens_own on push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_staff_read on push_tokens
  for select using (is_staff());
