-- =====================================================================
-- Soulfables — 0005 Reading
-- Progress, saves, bookmarks, and saved passages.
--
-- Every table here is reader-private and carries user_id as the first
-- column of its primary key, so RLS (0012) is a single uniform rule and
-- the indexes serve both the query and the policy.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Progress — powers "Continue reading" and "The House remembers."
-- One row per reader per story, upserted as they read.
-- ---------------------------------------------------------------------
create table reading_progress (
  user_id         uuid not null references auth.users(id) on delete cascade,
  story_id        uuid not null references stories(id) on delete cascade,
  -- 0.0000 .. 1.0000
  percent         numeric(5,4) not null default 0,
  -- Anchored to a section rather than a raw character offset so progress
  -- survives edits to the prose.
  section_id      uuid references story_sections(id) on delete set null,
  char_offset     integer,
  -- Audio and text positions are tracked separately: a reader may listen
  -- in the car and read at night, and neither should clobber the other.
  audio_position_seconds numeric(9,2),
  started_at      timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  completed_at    timestamptz,
  primary key (user_id, story_id),
  constraint percent_range check (percent between 0 and 1)
);

create index reading_progress_recent_idx
  on reading_progress (user_id, last_read_at desc);

create index reading_progress_unfinished_idx
  on reading_progress (user_id, last_read_at desc)
  where completed_at is null;

-- ---------------------------------------------------------------------
-- Saved stories — "A shelf of the ones that stayed."
-- ---------------------------------------------------------------------
create table saved_stories (
  user_id  uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references stories(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create index saved_stories_recent_idx on saved_stories (user_id, saved_at desc);

-- ---------------------------------------------------------------------
-- Bookmarks — a specific place, optionally annotated.
-- ---------------------------------------------------------------------
create table bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  story_id    uuid not null references stories(id) on delete cascade,
  section_id  uuid references story_sections(id) on delete set null,
  char_offset integer,
  note        text,
  created_at  timestamptz not null default now()
);

create index bookmarks_user_idx on bookmarks (user_id, created_at desc);
create index bookmarks_story_idx on bookmarks (user_id, story_id);

-- ---------------------------------------------------------------------
-- Saved passages — "Some sentences ask to be remembered."
-- The quoted text is denormalised on purpose: if the story is later
-- edited, the reader keeps the sentence they saved.
-- ---------------------------------------------------------------------
create table saved_passages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  story_id    uuid not null references stories(id) on delete cascade,
  section_id  uuid references story_sections(id) on delete set null,
  quote       text not null,
  char_start  integer,
  char_end    integer,
  colour      text,
  created_at  timestamptz not null default now()
);

create index saved_passages_user_idx on saved_passages (user_id, created_at desc);
create index saved_passages_story_idx on saved_passages (user_id, story_id);

-- ---------------------------------------------------------------------
-- Reading history — an append-only trail, distinct from progress.
-- Progress answers "where am I"; history answers "where have I been".
-- ---------------------------------------------------------------------
create table reading_history (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  story_id   uuid not null references stories(id) on delete cascade,
  opened_at  timestamptz not null default now(),
  duration_seconds integer,
  completed  boolean not null default false,
  surface    text  -- web | ios | android
);

create index reading_history_user_idx on reading_history (user_id, opened_at desc);
