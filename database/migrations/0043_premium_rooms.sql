-- =====================================================================
-- Soulfables — 0043 The Premium rooms: series, sleep, guided journals
--
-- Three things the membership page promises, given a place to live.
--
--   Series. The table has existed since 0004; stories carry series_id
--   and episode_number. It gains access, so a series can be exclusive
--   to Premium as a whole, and a sort order for the shelf of series.
--
--   Sleep stories. A flag on a story: read slowly, for the night, kept
--   for Premium to listen to. The player gets a sleep timer in the app.
--
--   Guided journals. A journey of prompts, one a day: the journal, its
--   steps, and where each reader has got to. Premium starts one; the
--   journal page shows the day's prompt; saving a reflection to it
--   moves the reader on.
--
-- story_for_reader() learns the two new locks: a story in a Premium
-- series is Premium, and a sleep story's narration is Premium.
-- =====================================================================

alter table series
  add column if not exists access     access_level not null default 'free',
  add column if not exists sort_order integer not null default 0;
comment on column series.access is 'premium: every episode is for Premium readers, whatever the story says.';

alter table stories
  add column if not exists for_sleep boolean not null default false;
comment on column stories.for_sleep is 'A sleep story: shown on /sleep, narration for Premium.';

-- ---------------------------------------------------------------------
-- Guided journals.
-- ---------------------------------------------------------------------
create table if not exists guided_journals (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists guided_journal_steps (
  id          uuid primary key default gen_random_uuid(),
  journal_id  uuid not null references guided_journals(id) on delete cascade,
  day         integer not null check (day >= 1),
  prompt      text not null,
  unique (journal_id, day)
);

create table if not exists guided_journal_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  journal_id  uuid not null references guided_journals(id) on delete cascade,
  started_at  timestamptz not null default now(),
  last_day    integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, journal_id)
);

alter table guided_journals enable row level security;
alter table guided_journal_steps enable row level security;
alter table guided_journal_progress enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'guided_journals' and policyname = 'guided_journals_public_read') then
    create policy guided_journals_public_read on guided_journals for select using (is_active or is_staff());
    create policy guided_journals_staff_write on guided_journals for all using (is_staff()) with check (is_staff());
    create policy guided_journal_steps_public_read on guided_journal_steps for select using (
      exists (select 1 from guided_journals g where g.id = journal_id and (g.is_active or is_staff()))
    );
    create policy guided_journal_steps_staff_write on guided_journal_steps for all using (is_staff()) with check (is_staff());
    create policy guided_journal_progress_self on guided_journal_progress for all
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Two journeys to begin with. Seven days each, in the House's register.
insert into guided_journals (slug, title, description, sort_order)
select v.slug, v.title, v.description, v.sort_order
from (values
  ('seven-nights-after-a-loss', 'Seven Nights After a Loss',
   'One page a night, for the week nobody tells you how to get through. Nothing to fix. Somewhere to put it.', 1),
  ('beginning-again', 'Beginning Again',
   'Seven mornings for a change you did not choose, or one you did and are frightened of anyway.', 2)
) as v(slug, title, description, sort_order)
where not exists (select 1 from guided_journals g where g.slug = v.slug);

insert into guided_journal_steps (journal_id, day, prompt)
select g.id, v.day, v.prompt
from guided_journals g
join (values
  ('seven-nights-after-a-loss', 1, 'Write down what today was like, plainly, as if to someone who was not there.'),
  ('seven-nights-after-a-loss', 2, 'What did they do that nobody else does? One thing. Describe it exactly.'),
  ('seven-nights-after-a-loss', 3, 'What are people saying to you that does not help? What would?'),
  ('seven-nights-after-a-loss', 4, 'Where in the house, or the day, is the absence loudest?'),
  ('seven-nights-after-a-loss', 5, 'What is one thing you have done this week that you could not have done last week?'),
  ('seven-nights-after-a-loss', 6, 'If you could ask them one question now, what would it be? Write their answer as you think they would give it.'),
  ('seven-nights-after-a-loss', 7, 'What do you want to keep? Not everything. One thing.'),
  ('beginning-again', 1, 'What is ending, and what have you not said about it yet?'),
  ('beginning-again', 2, 'What did the old life ask of you that you will not miss?'),
  ('beginning-again', 3, 'What are you afraid the new one will ask?'),
  ('beginning-again', 4, 'Who do you become when nobody remembers who you were?'),
  ('beginning-again', 5, 'Write the first ordinary day of the new life, hour by hour.'),
  ('beginning-again', 6, 'What would you tell someone standing where you stood a month ago?'),
  ('beginning-again', 7, 'What will you carry forward, and what will you set down at the door?')
) as v(slug, day, prompt) on v.slug = g.slug
where not exists (select 1 from guided_journal_steps s where s.journal_id = g.id and s.day = v.day);

-- ---------------------------------------------------------------------
-- The story page's question, with the two new locks.
-- ---------------------------------------------------------------------
create or replace function public.story_for_reader(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with who as (
    select * from reader_standing()
  ),
  s as (
    select st.*, se.slug as series_slug, se.title as series_title, se.access as series_access
    from stories st
    left join series se on se.id = st.series_id
    cross join who
    where st.slug = p_slug
      and (
        st.status = 'published'
        or (st.status = 'scheduled' and (who.staff or who.premium))
        or who.staff
        or exists (
          select 1 from authors a
          where a.id = st.assigned_author_id and a.user_id = auth.uid()
        )
      )
    limit 1
  ),
  access as (
    select
      s.id,
      case
        when who.staff then false
        when who.premium then false
        when s.access = 'premium' then true
        when s.series_access = 'premium' then true
        else false
      end as locked
    from s, who
  ),
  heard as (
    select exists (
      select 1 from narration_listens nl, s
      where nl.user_id = auth.uid() and nl.story_id = s.id
        and nl.month = date_trunc('month', now())::date
    ) as this_story
  )
  select case when (select count(*) from s) = 0 then null else (
    select json_build_object(
      'id',              s.id,
      'slug',            s.slug,
      'title',           s.title,
      'subtitle',        s.subtitle,
      'reading_minutes', s.reading_minutes,
      'access',          case when s.series_access = 'premium' then 'premium' else s.access end,
      'cover_image',     s.cover_image,
      'status',          s.status,
      'early_access',    (s.status = 'scheduled'),
      'scheduled_for',   s.scheduled_for,
      'for_sleep',       s.for_sleep,
      'series',          case when s.series_slug is null then null else json_build_object(
                           'slug', s.series_slug, 'title', s.series_title, 'episode', s.episode_number, 'access', s.series_access
                         ) end,
      'author',          (select a.name from authors a where a.id = s.author_id),
      'shelf',           (
        select sh.slug
        from story_shelves ss
        join shelves sh on sh.id = ss.shelf_id
        where ss.story_id = s.id
        order by ss.is_primary desc, ss.sort_order
        limit 1
      ),
      'locked',          access.locked,
      'body',            case when access.locked then null else s.body_mdx end,
      'audio',           (
        select json_build_object(
          'narrator',         au.narrator,
          'duration_seconds', au.duration_seconds,
          'format',           au.format,
          'access',           au.access,
          'generated',        au.generated,
          'locked',           (reason.why is not null),
          'reason',           reason.why,
          'listens_left',     greatest(0, who.allowance - who.listens)
        )
        from story_audio au, who, heard,
        lateral (
          select case
            when who.staff or who.premium then null
            when au.access = 'premium' or s.for_sleep or s.series_access = 'premium' then 'premium'
            when not who.signed_in then 'sign_in'
            when heard.this_story then null
            when who.listens >= who.allowance then 'allowance'
            else null
          end as why
        ) reason
        where au.story_id = s.id
        order by au.created_at desc
        limit 1
      )
    )
    from s, access, who
  ) end;
$$;

-- narration_for_reader: the same two locks.
drop function if exists public.narration_for_reader(text);
create function public.narration_for_reader(p_slug text)
returns table (storage_path text, format text, locked boolean, count_listen boolean, story_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with who as (select * from reader_standing())
  select
    au.storage_path,
    au.format::text,
    (
      case
        when who.staff or who.premium then false
        when au.access = 'premium' or s.for_sleep or se.access = 'premium' then true
        when not who.signed_in then true
        when exists (
          select 1 from narration_listens nl
          where nl.user_id = auth.uid() and nl.story_id = au.story_id
            and nl.month = date_trunc('month', now())::date
        ) then false
        when who.listens >= who.allowance then true
        else false
      end
    ) as locked,
    (not who.staff and not who.premium and au.access = 'free' and not s.for_sleep and coalesce(se.access, 'free') = 'free' and who.signed_in) as count_listen,
    au.story_id
  from story_audio au
  join stories s on s.id = au.story_id
  left join series se on se.id = s.series_id
  cross join who
  where s.slug = p_slug
    and (s.status = 'published' or (s.status = 'scheduled' and (who.staff or who.premium)) or who.staff)
  order by au.created_at desc
  limit 1;
$$;
grant execute on function public.narration_for_reader(text) to anon, authenticated;
