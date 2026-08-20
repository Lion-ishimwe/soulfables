-- =====================================================================
-- Soulfables — 0006 Journal
-- Moods, prompts, and private reflections.
--
-- Privacy posture: entries are private by default and the RLS policy in
-- 0012 grants NO staff read access — an admin can see that a reader has
-- 14 entries, never what any of them says. Sharing is modelled now
-- (entry_visibility) but no share surface is built until Phase 7, so the
-- column exists to make future sharing an explicit opt-in rather than a
-- schema migration that risks exposing history.
-- =====================================================================

-- Moods are a table, not an enum: the House will add moods.
create table moods (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,          -- "Heartbroken"
  emoji      text,
  -- Optional bridge into the library: choosing "Grieving" can suggest a shelf.
  shelf_id   uuid references shelves(id) on delete set null,
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

-- ---------------------------------------------------------------------
-- Prompts — "TODAY'S QUESTION: What part of yourself are you making
-- peace with?" Scheduled by date so the House can plan a season of them,
-- with a fallback pool when no date is scheduled.
-- ---------------------------------------------------------------------
create table journal_prompts (
  id           uuid primary key default gen_random_uuid(),
  body         text not null,
  kind         text not null default 'daily',  -- daily | shelf | story | deck
  shelf_id     uuid references shelves(id) on delete set null,
  story_id     uuid references stories(id) on delete set null,
  -- When set, this prompt is THE prompt for that calendar day.
  scheduled_on date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create unique index journal_prompts_scheduled_idx
  on journal_prompts (scheduled_on) where scheduled_on is not null and kind = 'daily';

create index journal_prompts_pool_idx
  on journal_prompts (kind, is_active) where scheduled_on is null;

-- ---------------------------------------------------------------------
-- Entries
-- ---------------------------------------------------------------------
create table journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  body       text not null,
  mood_id    uuid references moods(id) on delete set null,
  -- An entry may hang off a story, a specific section of one, or nothing
  -- at all. All three are first-class.
  story_id   uuid references stories(id) on delete set null,
  section_id uuid references story_sections(id) on delete set null,
  prompt_id  uuid references journal_prompts(id) on delete set null,
  visibility entry_visibility not null default 'private',
  -- Per-entry AI consent. Even with ai_may_read_journal on, an entry can
  -- be withheld. The AI service reads only where BOTH are true.
  ai_opt_in  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger journal_entries_updated_at before update on journal_entries
  for each row execute function set_updated_at();

create table journal_entry_tags (
  entry_id uuid not null references journal_entries(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

create index journal_entries_user_idx  on journal_entries (user_id, created_at desc);
create index journal_entries_story_idx on journal_entries (user_id, story_id);
create index journal_entries_mood_idx  on journal_entries (user_id, mood_id);

-- Private full-text search over the reader's own entries.
alter table journal_entries add column search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored;

create index journal_entries_search_idx on journal_entries using gin (search_vector);
