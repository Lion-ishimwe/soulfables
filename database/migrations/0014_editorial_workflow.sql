-- =====================================================================
-- Soulfables — 0014 Editorial workflow
--
-- Authors as accounts, submission and approval, handing a story to
-- another writer, serialised release, and the notifications that tell an
-- author what happened to their work.
--
-- Note what is NOT added: a "submitted" status. `in_review` already means
-- exactly that — the author has finished and it is with the House. A
-- second near-identical status would be two words for one state, and
-- every query would then have to remember both.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Authors are people who sign in
-- ---------------------------------------------------------------------
alter type app_role add value if not exists 'author' before 'editor';

-- Links a signing-in account to the byline it writes under. An author
-- record can still exist with no account — that is how The Librarian and
-- any historical contributor work.
alter table authors
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid references auth.users(id);

create unique index if not exists authors_user_idx
  on authors (user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- Submission, approval, and handing a story on
-- ---------------------------------------------------------------------
create type release_mode as enum ('full', 'serial');

alter table stories
  -- Who is writing it NOW. Distinct from author_id, which is the byline:
  -- a story begun by one writer and finished by another keeps its credit
  -- while the work moves.
  add column if not exists assigned_author_id uuid references authors(id) on delete set null,
  add column if not exists submitted_at  timestamptz,
  add column if not exists submitted_by  uuid references auth.users(id) on delete set null,
  add column if not exists approved_at   timestamptz,
  add column if not exists approved_by   uuid references auth.users(id) on delete set null,
  -- Whether readers get it whole or an episode at a time.
  add column if not exists release_mode  release_mode not null default 'full',
  -- Why it came back, when it comes back.
  add column if not exists revision_note text;

create index if not exists stories_assigned_idx
  on stories (assigned_author_id, status);

create index if not exists stories_submitted_idx
  on stories (submitted_at desc) where status = 'in_review';

-- ---------------------------------------------------------------------
-- Chapters
--
-- A story with no chapters is a whole story; that is the common case and
-- costs nothing. A serialised story has chapters, each with its own
-- publication date, so episodes appear on their own schedule rather than
-- all at once.
-- ---------------------------------------------------------------------
create table if not exists story_chapters (
  id            uuid primary key default gen_random_uuid(),
  story_id      uuid not null references stories(id) on delete cascade,
  number        integer not null,
  title         text not null,
  body_mdx      text,
  status        publish_status not null default 'draft',
  published_at  timestamptz,
  scheduled_for timestamptz,
  word_count    integer,
  reading_minutes integer,
  -- Chapters can change hands too.
  author_id     uuid references authors(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (story_id, number),
  constraint chapter_published_needs_date
    check (status <> 'published' or published_at is not null)
);

create trigger story_chapters_updated_at before update on story_chapters
  for each row execute function set_updated_at();

create index if not exists story_chapters_story_idx
  on story_chapters (story_id, number);

-- ---------------------------------------------------------------------
-- Notifications
--
-- What an author is told, and when they read it. Kept general rather
-- than approval-specific: the same table carries "your story is live",
-- "a story has been handed to you", and whatever comes next.
-- ---------------------------------------------------------------------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,   -- story.approved | story.published | story.assigned | story.returned
  title       text not null,
  body        text,
  -- Where the notification takes you.
  href        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on notifications (user_id, created_at desc);

create index if not exists notifications_unread_idx
  on notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table story_chapters enable row level security;
alter table notifications enable row level security;

-- Chapters follow their story: published chapters of published stories
-- are public; staff and the assigned author see the rest.
create policy story_chapters_public_read on story_chapters
  for select using (
    (status = 'published' and exists (
      select 1 from stories s where s.id = story_id and s.status = 'published'
    ))
    or is_staff()
    or exists (
      select 1 from stories s
      join authors a on a.id = s.assigned_author_id
      where s.id = story_id and a.user_id = auth.uid()
    )
  );

create policy story_chapters_staff_write on story_chapters
  for all using (is_staff()) with check (is_staff());

-- An author may edit chapters of a story assigned to them.
create policy story_chapters_author_write on story_chapters
  for all using (
    exists (
      select 1 from stories s
      join authors a on a.id = s.assigned_author_id
      where s.id = story_id and a.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from stories s
      join authors a on a.id = s.assigned_author_id
      where s.id = story_id and a.user_id = auth.uid()
    )
  );

-- Notifications are yours alone. Staff have no read policy here: an
-- administrator can send one, and cannot browse someone's inbox.
create policy notifications_self_read on notifications
  for select using (user_id = auth.uid());

create policy notifications_self_update on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Writing a story assigned to you, without being staff.
create policy stories_author_read on stories
  for select using (
    exists (
      select 1 from authors a
      where a.id = stories.assigned_author_id and a.user_id = auth.uid()
    )
  );

create policy stories_author_write on stories
  for update using (
    exists (
      select 1 from authors a
      where a.id = stories.assigned_author_id and a.user_id = auth.uid()
    )
    -- An author may work on it, but not publish it. Only the House does
    -- that, which is the whole point of the review step.
    and status in ('draft', 'in_review')
  ) with check (
    exists (
      select 1 from authors a
      where a.id = stories.assigned_author_id and a.user_id = auth.uid()
    )
    and status in ('draft', 'in_review')
  );
