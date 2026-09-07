-- =====================================================================
-- Soulfables — 0030 Reading progress keeps the furthest point
--
-- reading_progress.percent was whatever the last beacon said. The last
-- beacon fires as the reader leaves the page — and a reader who has
-- finished a story and scrolled back to the top to leave it sends 0.
-- So "0%" on a shelf could mean "never started" or "read every word
-- and then went back up", and nothing could tell the two apart.
--
-- Progress through a story is how far someone has *got*, not where they
-- happen to be standing. So percent only ever rises. The place they are
-- standing — section and character offset, used to put them back where
-- they were — still takes the latest value, because that is what it is
-- for.
--
-- Enforced here rather than in the app for the usual reason: the web
-- beacon is one writer today; the Flutter client, a backfill, or a
-- support person in the SQL editor are others, and the rule should hold
-- for all of them.
-- =====================================================================

create or replace function public.keep_reading_high_water()
returns trigger
language plpgsql
as $$
begin
  if new.percent < old.percent then
    new.percent := old.percent;
  end if;

  -- Finishing a story is not undone by rereading its opening. The app
  -- already never clears completed_at; now the database agrees.
  if old.completed_at is not null then
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$;

comment on function public.keep_reading_high_water() is
  'reading_progress.percent never decreases and completed_at is never cleared: progress is the furthest point reached, not the current scroll position.';

drop trigger if exists reading_progress_high_water on reading_progress;
create trigger reading_progress_high_water
  before update on reading_progress
  for each row
  execute function public.keep_reading_high_water();

-- A finished story is a story read to the end, whatever the last beacon
-- happened to say about the scroll position on the way out.
update reading_progress
   set percent = 1
 where completed_at is not null
   and percent < 1;
