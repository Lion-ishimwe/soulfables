-- =====================================================================
-- Soulfables — 0024 Story counters that something actually writes
--
-- stories.view_count and stories.completion_count have existed since
-- 0004 and nothing has ever incremented either. Three places read them
-- — the Report's "Most read", the dashboard's story table, and the story
-- page itself — so all three have been confidently printing zero for
-- every story since the day they were built.
--
-- Meanwhile the real opens were being recorded correctly the whole time,
-- into analytics_events, by track() in lib/analytics.ts. The count and
-- the counter were simply never joined up.
--
-- This is the same shape as the demo-only branches: a read path with no
-- write path behind it, which is indistinguishable from "nobody has read
-- anything" and therefore never looks like a bug.
--
-- Fixed at the database rather than in the application, so it holds no
-- matter who inserts the event — the web app today, the Flutter client
-- later, a backfill script, a support person in the SQL editor.
-- =====================================================================

create or replace function public.bump_story_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SECURITY DEFINER because the inserter is usually anon, who may write
  -- an event and must not be able to write to stories. The function is
  -- the only thing that crosses that line, and it crosses it for exactly
  -- two event names on exactly two columns.
  if new.entity_type = 'story' and new.entity_id is not null then
    if new.event_name = 'story_opened' then
      update stories set view_count = view_count + 1 where id = new.entity_id;
    elsif new.event_name = 'story_completed' then
      update stories set completion_count = completion_count + 1 where id = new.entity_id;
    end if;
  end if;

  return new;
end
$$;

comment on function public.bump_story_counter() is
  'Keeps stories.view_count / completion_count in step with analytics_events. Trigger, not application code, so every client counts the same way.';

drop trigger if exists analytics_events_bump_story on analytics_events;

create trigger analytics_events_bump_story
  after insert on analytics_events
  for each row
  execute function public.bump_story_counter();

-- ---------------------------------------------------------------------
-- Backfill.
--
-- Every event already recorded is a real open by a real person, and
-- throwing them away because the counter arrived late would be a choice
-- to under-report. Set rather than add, so re-running this migration
-- cannot double anything.
-- ---------------------------------------------------------------------
update stories s
set view_count       = coalesce(e.opens, 0),
    completion_count = coalesce(e.finished, 0)
from (
  select entity_id,
         count(*) filter (where event_name = 'story_opened')    as opens,
         count(*) filter (where event_name = 'story_completed') as finished
  from analytics_events
  where entity_type = 'story' and entity_id is not null
  group by entity_id
) e
where s.id = e.entity_id;
