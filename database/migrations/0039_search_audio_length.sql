-- =====================================================================
-- Soulfables — 0039 Search results know how long the narration is
--
-- The card badge now says "♪ 14 min" rather than "Narrated", so the
-- search function returns the narration's length with the rest of what
-- a card needs. A return type cannot change in place; dropped and made
-- again with one more column.
-- =====================================================================

drop function if exists public.search_stories(text, integer);

create function public.search_stories(p_query text, p_limit integer default 50)
returns table (
  id              uuid,
  slug            text,
  title           text,
  subtitle        text,
  reading_minutes integer,
  access          access_level,
  cover_image     text,
  author_name     text,
  shelf_slug      text,
  has_audio       boolean,
  audio_seconds   integer,
  rank            real,
  fuzzy           boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('english', coalesce(p_query, '')) as tsq,
           lower(left(coalesce(p_query, ''), 200)) as raw
  ),
  base as (
    select
      s.id, s.slug, s.title, s.subtitle, s.reading_minutes, s.access, s.cover_image,
      (select a.name from authors a where a.id = s.author_id) as author_name,
      (
        select sh.slug from story_shelves ss join shelves sh on sh.id = ss.shelf_id
        where ss.story_id = s.id order by ss.is_primary desc, ss.sort_order limit 1
      ) as shelf_slug,
      exists (select 1 from story_audio au where au.story_id = s.id) as has_audio,
      (select au.duration_seconds from story_audio au where au.story_id = s.id order by au.created_at desc limit 1) as audio_seconds,
      s.search_vector,
      lower(concat_ws(' ', s.title, s.subtitle, s.excerpt)) as words
    from stories s
    where s.status = 'published'
  ),
  matched as (
    select b.id, b.slug, b.title, b.subtitle, b.reading_minutes, b.access, b.cover_image,
           b.author_name, b.shelf_slug, b.has_audio, b.audio_seconds,
           ts_rank_cd(b.search_vector, q.tsq) as rank, false as fuzzy
    from base b, q
    where q.tsq <> ''::tsquery and b.search_vector @@ q.tsq
  ),
  nearby as (
    select b.id, b.slug, b.title, b.subtitle, b.reading_minutes, b.access, b.cover_image,
           b.author_name, b.shelf_slug, b.has_audio, b.audio_seconds,
           word_similarity(q.raw, b.words) as rank, true as fuzzy
    from base b, q
    where not exists (select 1 from matched)
      and length(q.raw) >= 3
      and word_similarity(q.raw, b.words) > 0.3
  )
  select id, slug, title, subtitle, reading_minutes, access, cover_image, author_name, shelf_slug, has_audio, audio_seconds, rank, fuzzy
  from (
    select * from matched
    union all
    select * from nearby
  ) r
  order by rank desc, title
  limit greatest(1, least(p_limit, 100));
$$;

comment on function public.search_stories(text, integer) is
  'Published stories matching a query: ranked full-text results, or — when there are none — words within a typo of it. Never returns a body.';

grant execute on function public.search_stories(text, integer) to anon, authenticated;
