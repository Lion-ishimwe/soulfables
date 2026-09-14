-- =====================================================================
-- Soulfables — 0036 A typo finds the word, not only the title
--
-- 0035's fallback compared the whole query to the whole title, so
-- "greif" found nothing: no title contains the word, and a five-letter
-- query barely resembles a six-word title. word_similarity() asks
-- whether the query is close to any word in the text, and the text is
-- widened to the subtitle and excerpt, which is where a shelf's word
-- usually sits.
-- =====================================================================

create or replace function public.search_stories(p_query text, p_limit integer default 50)
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
      s.search_vector,
      lower(concat_ws(' ', s.title, s.subtitle, s.excerpt)) as words
    from stories s
    where s.status = 'published'
  ),
  matched as (
    select b.id, b.slug, b.title, b.subtitle, b.reading_minutes, b.access, b.cover_image,
           b.author_name, b.shelf_slug, b.has_audio,
           ts_rank_cd(b.search_vector, q.tsq) as rank, false as fuzzy
    from base b, q
    where q.tsq <> ''::tsquery and b.search_vector @@ q.tsq
  ),
  nearby as (
    select b.id, b.slug, b.title, b.subtitle, b.reading_minutes, b.access, b.cover_image,
           b.author_name, b.shelf_slug, b.has_audio,
           word_similarity(q.raw, b.words) as rank, true as fuzzy
    from base b, q
    where not exists (select 1 from matched)
      and length(q.raw) >= 3
      and word_similarity(q.raw, b.words) > 0.3
  )
  select id, slug, title, subtitle, reading_minutes, access, cover_image, author_name, shelf_slug, has_audio, rank, fuzzy
  from (
    select * from matched
    union all
    select * from nearby
  ) r
  order by rank desc, title
  limit greatest(1, least(p_limit, 100));
$$;
