-- =====================================================================
-- Soulfables — 0004 Stories
-- The story record, its sections, its taxonomy joins, audio, and the
-- story-to-story relation graph.
-- =====================================================================

create table series (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text,
  cover_image text,
  status      publish_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger series_updated_at before update on series
  for each row execute function set_updated_at();

create table stories (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  -- The one-line logline under every card: "A modern folktale about the
  -- rooms grief keeps lit."
  subtitle        text,
  -- The pull-quote used on shelf pages and social cards.
  excerpt         text,
  -- Story body as MDX. Chosen over a rich-text JSON blob so that stories
  -- survive this platform: they are portable, diffable, and reviewable.
  -- Section markers (":: The House Waits") are parsed into story_sections
  -- on save.
  body_mdx        text,
  cover_image     text,
  author_id       uuid references authors(id) on delete set null,
  series_id       uuid references series(id) on delete set null,
  episode_number  integer,

  reading_minutes integer,
  word_count      integer,

  status          publish_status not null default 'draft',
  access          access_level not null default 'free',
  is_featured     boolean not null default false,
  published_at    timestamptz,
  scheduled_for   timestamptz,

  -- Denormalised counters. Updated by jobs, never trusted for
  -- authorisation — only for sorting and display.
  view_count       bigint not null default 0,
  completion_count bigint not null default 0,
  save_count       bigint not null default 0,

  seo_title       text,
  seo_description text,
  og_image        text,
  canonical_url   text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint published_needs_date
    check (status <> 'published' or published_at is not null)
);

create trigger stories_updated_at before update on stories
  for each row execute function set_updated_at();

-- Deferred FK from 0003, now that stories exists.
alter table shelves
  add constraint shelves_entry_story_fk
  foreign key (entry_story_id) references stories(id) on delete set null;

-- ---------------------------------------------------------------------
-- Sections
-- Parsed from the ":: Section Title" markers in body_mdx. These are what
-- bookmarks, audio cue points and journal entries anchor to, so a reader's
-- saved position survives a copy-edit of the surrounding prose.
-- ---------------------------------------------------------------------
create table story_sections (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid not null references stories(id) on delete cascade,
  slug        text not null,
  title       text,
  position    integer not null,
  char_start  integer,
  char_end    integer,
  audio_start_seconds numeric(9,2),
  unique (story_id, slug),
  unique (story_id, position)
);

-- ---------------------------------------------------------------------
-- Taxonomy joins
-- ---------------------------------------------------------------------
create table story_shelves (
  story_id   uuid not null references stories(id) on delete cascade,
  shelf_id   uuid not null references shelves(id) on delete cascade,
  -- Exactly one primary shelf per story drives breadcrumbs and canonical URL.
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  primary key (story_id, shelf_id)
);

create unique index story_one_primary_shelf
  on story_shelves (story_id) where is_primary;

create table story_themes (
  story_id uuid not null references stories(id) on delete cascade,
  theme_id uuid not null references themes(id) on delete cascade,
  primary key (story_id, theme_id)
);

create table story_tags (
  story_id uuid not null references stories(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (story_id, tag_id)
);

-- ---------------------------------------------------------------------
-- Story relations — "READERS ALSO STAYED FOR"
-- Same pattern as shelf_journeys: editorial today, computed later.
-- ---------------------------------------------------------------------
create table story_relations (
  story_id         uuid not null references stories(id) on delete cascade,
  related_story_id uuid not null references stories(id) on delete cascade,
  relation_type    text not null default 'readers_also',
  weight           numeric(5,4) not null default 0.5,
  is_editorial     boolean not null default true,
  sort_order       integer not null default 0,
  primary key (story_id, related_story_id, relation_type),
  constraint no_self_relation check (story_id <> related_story_id)
);

-- ---------------------------------------------------------------------
-- Audio (brief §12) — modelled per story from day one, never bolted on.
-- ---------------------------------------------------------------------
create table story_audio (
  id               uuid primary key default gen_random_uuid(),
  story_id         uuid not null references stories(id) on delete cascade,
  storage_path     text not null,   -- private bucket key, never a public URL
  format           file_format not null default 'mp3',
  duration_seconds integer,
  file_size_bytes  bigint,
  narrator         text,
  access           access_level not null default 'free',
  is_downloadable  boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (story_id, format)
);

-- ---------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------
alter table stories add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(body_mdx, '')), 'D')
  ) stored;

create index stories_search_idx        on stories using gin (search_vector);
create index stories_title_trgm_idx    on stories using gin (title gin_trgm_ops);
create index stories_feed_idx          on stories (status, published_at desc);
create index stories_featured_idx      on stories (is_featured, published_at desc) where status = 'published';
create index stories_author_idx        on stories (author_id);
create index stories_series_idx        on stories (series_id, episode_number);
create index story_shelves_shelf_idx   on story_shelves (shelf_id, sort_order);
create index story_sections_story_idx  on story_sections (story_id, position);

-- ---------------------------------------------------------------------
-- Embeddings (Phase 6)
--
-- Added only where pgvector exists. Keeping this conditional means the
-- schema applies on any Postgres — CI, a local harness, a managed
-- instance without the extension — and the Intelligence layer is enabled
-- by installing pgvector and re-running this block, not by a migration
-- that rewrites the stories table.
--
-- ivfflat needs data to train on, so REINDEX after the first meaningful
-- backfill.
-- ---------------------------------------------------------------------
do $emb$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    alter table stories add column if not exists embedding vector(1536);

    create index if not exists stories_embedding_idx on stories
      using ivfflat (embedding vector_cosine_ops) with (lists = 100);
  else
    raise notice 'pgvector not installed — stories.embedding not created';
  end if;
end
$emb$;
