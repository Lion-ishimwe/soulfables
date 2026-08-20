-- =====================================================================
-- Soulfables — 0003 Taxonomy
-- Authors, shelves, themes, tags, and the shelf journey graph.
--
-- Two distinct taxonomies, deliberately:
--   THEMES  — editorial classification. Flat, used for filters and SEO.
--   SHELVES — emotional entry points. A shelf is a *place in the House*
--             with its own copy, Librarian note, entry story and journey.
-- The live site proves they are not the same thing: the shelf labelled
-- "Sleepless" lives at /shelf/anxiety. Label, slug and theme are
-- independent fields, so editorial can rename a shelf without breaking
-- a URL or re-tagging every story on it.
-- =====================================================================

create table authors (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  bio          text,
  avatar_url   text,
  -- "The Librarian" is a house voice, not a person. Personas are rendered
  -- without the human-author schema.org markup and have no payout record.
  is_persona   boolean not null default false,
  links        jsonb not null default '{}'::jsonb,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger authors_updated_at before update on authors
  for each row execute function set_updated_at();

-- Editorial themes. Admin-manageable: adding "Forgiveness" must never
-- require a deploy (brief §6).
create table themes (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  emoji       text,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Shelves: the Library of Feelings.
create table shelves (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,          -- URL: /shelf/anxiety
  label           text not null,                 -- Nav chip: "Sleepless"
  title           text not null,                 -- H1: "Stories About Heartbreak"
  emoji           text,
  tagline         text,                          -- "Love, loss, and the slow art of letting go."
  description     text,
  -- The Librarian's note is editorial copy with real navigational intent:
  -- it points readers onward to another shelf.
  librarian_note  text,
  -- "BEGIN HERE" — the curated first read for a newcomer to this shelf.
  entry_story_id  uuid,                          -- FK added in 0004 (stories not yet created)
  cover_image     text,
  accent_color    text,
  sort_order      integer not null default 0,
  status          publish_status not null default 'draft',
  seo_title       text,
  seo_description text,
  og_image        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger shelves_updated_at before update on shelves
  for each row execute function set_updated_at();

-- Free-form tags, for search and the Intelligence layer.
create table tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- The journey graph
--
-- The live shelf page already renders this: "Readers usually come here
-- from Grief, Love, Heartbreak / usually continue to Healing, Hope,
-- Forgiveness." Today those edges are editorial judgement. Modelling them
-- as rows now means the same UI can later be fed by observed behaviour
-- without a redesign — `weight` becomes computed and `is_editorial`
-- flips to false. This is the cheapest possible seed of brief §14.
-- ---------------------------------------------------------------------
create table shelf_journeys (
  id             uuid primary key default gen_random_uuid(),
  shelf_id       uuid not null references shelves(id) on delete cascade,
  related_shelf_id uuid not null references shelves(id) on delete cascade,
  direction      journey_direction not null,
  weight         numeric(5,4) not null default 0.5,
  is_editorial   boolean not null default true,
  computed_at    timestamptz,
  sort_order     integer not null default 0,
  constraint no_self_journey check (shelf_id <> related_shelf_id),
  unique (shelf_id, related_shelf_id, direction)
);

create index shelf_journeys_shelf_idx on shelf_journeys (shelf_id, direction, sort_order);
create index shelves_status_idx on shelves (status, sort_order);
create index themes_active_idx on themes (is_active, sort_order);
