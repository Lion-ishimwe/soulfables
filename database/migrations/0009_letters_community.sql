-- =====================================================================
-- Soulfables — 0009 The Weekly Letter, Reader Voices, Residents
--
-- The Letter is already at Vol. 1 / Letter 28, so it is a real publication
-- with an archive, not a mailing-list integration. It gets first-class
-- records here and its own SEO-indexable archive pages.
--
-- Residents (brief §5) is deliberately thin: the concept is unsettled, so
-- this file models only what is already visible on the site — a resident
-- profile and unsigned reader voices — and stops there.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The Weekly Letter
-- ---------------------------------------------------------------------
create table letters (
  id            uuid primary key default gen_random_uuid(),
  volume        integer not null default 1,
  number        integer not null,
  slug          text not null unique,
  title         text not null,
  -- The email subject line, which is often not the on-page title.
  subject       text,
  dek           text,               -- "The week of July 28"
  body_mdx      text not null,
  -- Editorial links out of the letter, so the archive page can render
  -- real cards instead of raw anchors.
  featured_shelf_id uuid references shelves(id) on delete set null,
  featured_story_id uuid references stories(id) on delete set null,
  status        publish_status not null default 'draft',
  published_at  timestamptz,
  sent_at       timestamptz,
  seo_description text,
  og_image      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (volume, number)
);

create trigger letters_updated_at before update on letters
  for each row execute function set_updated_at();

create index letters_feed_idx on letters (status, published_at desc);

-- Subscribers are tracked separately from accounts: most people who want
-- the Letter will not have signed up, and unsubscribing must never affect
-- a reader's account or their receipts.
create table letter_subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  user_id        uuid references auth.users(id) on delete set null,
  status         subscriber_status not null default 'pending',
  -- Double opt-in token. Single-use, expires.
  confirm_token  text unique,
  token_expires_at timestamptz,
  confirmed_at   timestamptz,
  unsubscribed_at timestamptz,
  -- Signed, single-use value embedded in every send's List-Unsubscribe.
  unsubscribe_token text unique default encode(gen_random_bytes(24), 'hex'),
  source         text,     -- footer | shelf | checkout | import
  created_at     timestamptz not null default now()
);

create unique index letter_subscribers_email_idx on letter_subscribers (lower(email));
create index letter_subscribers_status_idx on letter_subscribers (status);

-- One row per subscriber per letter. Makes "did they get it?" answerable
-- and gives the admin dashboard real open/click numbers per issue.
create table letter_sends (
  id            bigserial primary key,
  letter_id     uuid not null references letters(id) on delete cascade,
  subscriber_id uuid not null references letter_subscribers(id) on delete cascade,
  provider_message_id text,
  sent_at       timestamptz not null default now(),
  delivered_at  timestamptz,
  opened_at     timestamptz,
  clicked_at    timestamptz,
  bounced_at    timestamptz,
  bounce_reason text,
  unique (letter_id, subscriber_id)
);

create index letter_sends_letter_idx on letter_sends (letter_id);

-- ---------------------------------------------------------------------
-- Reader Voices — "people leave a line and don't sign their name."
-- Unsigned by design, moderated before publication.
-- ---------------------------------------------------------------------
create table reader_voices (
  id           uuid primary key default gen_random_uuid(),
  -- Nullable and never displayed: retained only so a person can withdraw
  -- their own line, and for abuse handling.
  user_id      uuid references auth.users(id) on delete set null,
  body         text not null,
  story_id     uuid references stories(id) on delete set null,
  shelf_id     uuid references shelves(id) on delete set null,
  status       publish_status not null default 'in_review',
  approved_by  uuid references auth.users(id),
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint body_length check (char_length(body) between 2 and 600)
);

create index reader_voices_published_idx
  on reader_voices (status, created_at desc);

-- ---------------------------------------------------------------------
-- Residents — placeholder shape only. Expanded in Phase 7 once the
-- concept is decided. Modelled now so the nav item resolves to something
-- real instead of the 404 the live site currently returns.
-- ---------------------------------------------------------------------
create table resident_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  public_name  text,
  intro        text,
  is_public    boolean not null default false,
  joined_at    timestamptz not null default now()
);
