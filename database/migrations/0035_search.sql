-- =====================================================================
-- Soulfables — 0035 Search that ranks, and forgives a typo
--
-- The search vector has carried weights since 0004 (title A, subtitle B,
-- excerpt C, body D) and nothing ordered by them: results came back in
-- whatever order the planner found them. And pg_trgm has been installed
-- since 0001 with an index on titles that nothing queried, so "greif"
-- found nothing.
--
-- One function does both: ranked full-text results first, and when
-- those come up empty, the titles nearest the words typed. It returns
-- the fields a card needs — cover, shelf, narration — so a search result
-- looks like the same story everywhere else. The body is used for
-- matching and never returned.
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
           left(coalesce(p_query, ''), 200) as raw
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
      s.search_vector
    from stories s
    where s.status = 'published'
  ),
  matched as (
    select b.*, ts_rank_cd(b.search_vector, q.tsq) as rank, false as fuzzy
    from base b, q
    where q.tsq <> ''::tsquery and b.search_vector @@ q.tsq
  ),
  nearby as (
    select b.*, similarity(b.title, q.raw) as rank, true as fuzzy
    from base b, q
    where not exists (select 1 from matched)
      and q.raw <> ''
      and similarity(b.title, q.raw) > 0.18
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

comment on function public.search_stories(text, integer) is
  'Published stories matching a query: ranked full-text results, or — when there are none — titles within a typo of it. Never returns a body.';

grant execute on function public.search_stories(text, integer) to anon, authenticated;
