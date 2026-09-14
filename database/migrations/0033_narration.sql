-- =====================================================================
-- Soulfables — 0033 Narration that can actually be heard
--
-- story_audio has been complete since 0004 and nothing has ever put a
-- file behind it. Three seeded rows point at objects that were never
-- uploaded, so three stories wear a "Narrated" badge and play nothing;
-- and story_for_reader() handed the raw storage key to the page, which
-- the browser could not fetch even if the file existed.
--
-- This makes the reader side honest:
--   - the reader function returns the narration's duration, access and
--     whether THIS reader may hear it (premium narration is for
--     residents), never the storage key;
--   - the phantom seed rows go, so a badge means a file.
-- The route that turns a narration into a playable address, and the
-- admin upload that puts files there, live in the application.
-- =====================================================================

-- Whether a synthetic voice is reading. The player says so; a reader
-- should never mistake a generated voice for a person's.
alter table story_audio
  add column if not exists generated boolean not null default false;

-- Rows that promise a file the bucket does not hold.
delete from story_audio au
 where not exists (
   select 1 from storage.objects o
    where o.bucket_id = 'protected-media'
      and o.name = au.storage_path
 );

create or replace function public.story_for_reader(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select *
    from stories
    where slug = p_slug
      and (
        status = 'published'
        or is_staff()
        or exists (
          select 1 from authors a
          where a.id = stories.assigned_author_id and a.user_id = auth.uid()
        )
      )
    limit 1
  ),
  who as (
    -- Resident, staff, or neither — decided once and used for both the
    -- prose and the narration, so the two can never disagree.
    select
      is_staff() as staff,
      exists (
        select 1
        from subscriptions sub
        join plans p on p.id = sub.plan_id
        where sub.user_id = auth.uid()
          and sub.status in ('trialing', 'active')
          and (sub.current_period_end is null or sub.current_period_end > now())
          and p.slug = 'resident'
      ) as resident
  ),
  access as (
    select
      s.id,
      case
        when who.staff then false
        when s.access = 'free' then false
        when who.resident then false
        else true
      end as locked
    from s, who
  )
  select case when (select count(*) from s) = 0 then null else (
    select json_build_object(
      'id',              s.id,
      'slug',            s.slug,
      'title',           s.title,
      'subtitle',        s.subtitle,
      'reading_minutes', s.reading_minutes,
      'access',          s.access,
      'cover_image',     s.cover_image,
      'status',          s.status,
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
      -- Withheld here, not in the page. A locked story carries no prose
      -- across the wire at all.
      'body',            case when access.locked then null else s.body_mdx end,
      -- The narration's facts, and whether this reader may hear it. The
      -- storage key stays on the server: the audio route signs it.
      'audio',           (
        select json_build_object(
          'narrator',         au.narrator,
          'duration_seconds', au.duration_seconds,
          'format',           au.format,
          'access',           au.access,
          'generated',        au.generated,
          'locked',           (au.access = 'premium' and not who.staff and not who.resident)
        )
        from story_audio au, who
        where au.story_id = s.id
        order by au.created_at desc
        limit 1
      )
    )
    from s, access
  ) end;
$$;

comment on function public.story_for_reader(text) is
  'A story, its shelf, its narration (facts and whether this reader may hear it) and its body if this reader may have it — in one request. Same withholding rule as story_body().';

-- ---------------------------------------------------------------------
-- The narration route asks one question: may this reader hear this
-- story's narration, and where is the file. Answered by the database so
-- the rule is the same one story_for_reader() applies.
-- ---------------------------------------------------------------------
create or replace function public.narration_for_reader(p_slug text)
returns table (storage_path text, format text, locked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    au.storage_path,
    au.format::text,
    (
      au.access = 'premium'
      and not is_staff()
      and not exists (
        select 1
        from subscriptions sub
        join plans p on p.id = sub.plan_id
        where sub.user_id = auth.uid()
          and sub.status in ('trialing', 'active')
          and (sub.current_period_end is null or sub.current_period_end > now())
          and p.slug = 'resident'
      )
    ) as locked
  from story_audio au
  join stories s on s.id = au.story_id
  where s.slug = p_slug
    and (s.status = 'published' or is_staff())
  order by au.created_at desc
  limit 1;
$$;

comment on function public.narration_for_reader(text) is
  'The narration file for a story and whether the caller may hear it. Used by the audio route to sign a URL; never exposed to the page.';

grant execute on function public.narration_for_reader(text) to anon, authenticated;
