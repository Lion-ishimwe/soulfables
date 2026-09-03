-- =====================================================================
-- Soulfables — 0025 Reading times that match the prose
--
-- Every story was seeded with a reading time chosen independently of its
-- body: 6 to 11 minutes against bodies of roughly 350 words, which at any
-- honest reading speed is about two minutes. The number on the card was
-- not a measurement of anything.
--
-- Worse, it was drifting. saveStory recomputes the estimate, so the times
-- would have corrected themselves one story at a time as each was edited
-- — leaving the Library showing 11 min beside 2 min for two stories of
-- the same length, with no way to tell which was true.
--
-- Done in the database rather than the application because the seed is
-- what got it wrong, and the seed does not run application code. A
-- trigger holds for every writer: the admin editor, the studio, a
-- template import, a support person in the SQL editor, the Flutter client
-- later.
--
-- The estimate deliberately matches countWords() and WORDS_PER_MINUTE in
-- app/actions/stories.ts, so a save through the app and a write through
-- SQL produce the same number rather than fighting each other.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The estimate
-- ---------------------------------------------------------------------

create or replace function public.story_word_count(p_body text)
returns integer
language sql
immutable
as $$
  -- Mirrors text.trim().split(/\s+/).filter(Boolean).length exactly,
  -- including the empty-string case: splitting '' yields one empty
  -- element, which is zero words, not one.
  select case
    when p_body is null or btrim(p_body) = '' then 0
    else coalesce(array_length(regexp_split_to_array(btrim(p_body), '\s+'), 1), 0)
  end;
$$;

create or replace function public.reading_minutes_for(p_words integer)
returns integer
language sql
immutable
as $$
  -- 220 words a minute, the average for narrative prose, rounded up.
  -- Never zero: a story you can read in forty seconds is still a story,
  -- and "0 min" reads as an error rather than as a short piece.
  select greatest(1, ceil(coalesce(p_words, 0) / 220.0)::integer);
$$;

comment on function public.story_word_count(text) is
  'Words in a body, counted the same way the application counts them.';
comment on function public.reading_minutes_for(integer) is
  'Reading estimate at 220 wpm, minimum one minute. Matches WORDS_PER_MINUTE in the web app.';

-- ---------------------------------------------------------------------
-- Chapters carry their own count
-- ---------------------------------------------------------------------

create or replace function public.set_chapter_reading()
returns trigger
language plpgsql
as $$
begin
  new.word_count      := public.story_word_count(new.body_mdx);
  new.reading_minutes := public.reading_minutes_for(new.word_count);
  return new;
end
$$;

drop trigger if exists story_chapters_reading on story_chapters;

create trigger story_chapters_reading
  before insert or update of body_mdx on story_chapters
  for each row
  execute function public.set_chapter_reading();

-- ---------------------------------------------------------------------
-- Stories
--
-- A serial keeps its prose in its chapters and its own body is empty, so
-- measuring the body would report one minute for a novel. It sums its
-- chapters instead — the published ones where any are published, because
-- reading_minutes is a promise to a reader about what they can read now,
-- and all of them otherwise, so a draft serial still shows its true size
-- to the House.
-- ---------------------------------------------------------------------

create or replace function public.story_reading_words(p_story_id uuid, p_body text, p_mode text)
returns integer
language plpgsql
stable
as $$
declare
  v_published integer;
  v_all       integer;
begin
  if p_mode is distinct from 'serial' then
    return public.story_word_count(p_body);
  end if;

  select coalesce(sum(word_count) filter (where status = 'published'), 0),
         coalesce(sum(word_count), 0)
    into v_published, v_all
  from story_chapters
  where story_id = p_story_id;

  return case when v_published > 0 then v_published else v_all end;
end
$$;

create or replace function public.set_story_reading()
returns trigger
language plpgsql
as $$
begin
  new.word_count      := public.story_reading_words(new.id, new.body_mdx, new.release_mode::text);
  new.reading_minutes := public.reading_minutes_for(new.word_count);
  return new;
end
$$;

drop trigger if exists stories_reading on stories;

create trigger stories_reading
  before insert or update of body_mdx, release_mode on stories
  for each row
  execute function public.set_story_reading();

-- A chapter changing changes the length of the serial it belongs to.
create or replace function public.refresh_serial_reading()
returns trigger
language plpgsql
as $$
declare
  v_story uuid := coalesce(new.story_id, old.story_id);
  v_words integer;
begin
  select public.story_reading_words(s.id, s.body_mdx, s.release_mode::text)
    into v_words
  from stories s where s.id = v_story;

  if v_words is not null then
    update stories
       set word_count      = v_words,
           reading_minutes = public.reading_minutes_for(v_words)
     where id = v_story
       and (word_count is distinct from v_words
            or reading_minutes is distinct from public.reading_minutes_for(v_words));
  end if;

  return null;
end
$$;

drop trigger if exists story_chapters_refresh_serial on story_chapters;

create trigger story_chapters_refresh_serial
  after insert or update or delete on story_chapters
  for each row
  execute function public.refresh_serial_reading();

-- ---------------------------------------------------------------------
-- Backfill. Set rather than adjust, so re-running changes nothing.
-- ---------------------------------------------------------------------

update stories s
set word_count      = public.story_reading_words(s.id, s.body_mdx, s.release_mode::text),
    reading_minutes = public.reading_minutes_for(
                        public.story_reading_words(s.id, s.body_mdx, s.release_mode::text));

update story_chapters c
set word_count      = public.story_word_count(c.body_mdx),
    reading_minutes = public.reading_minutes_for(public.story_word_count(c.body_mdx));
