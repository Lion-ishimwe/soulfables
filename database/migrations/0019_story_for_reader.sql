-- =====================================================================
-- Soulfables — 0019 One request for a story
--
-- Opening a story cost three round trips: the row, then whether this
-- reader has premium access, then the body. Three questions about one
-- story, asked one after another, each about 300ms from here — so the
-- most important page on a reading site was the slowest public page on
-- it.
--
-- This answers all three at once. It replaces nothing about the security
-- model: the body is still withheld exactly where story_body() withheld
-- it, by the same conditions, in the same place. It is the same rule
-- asked once instead of three times.
-- =====================================================================

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
  access as (
    select
      s.id,
      -- Locked exactly when story_body() would refuse: a published
      -- premium story, and a reader without a resident subscription.
      case
        when is_staff() then false
        when s.access = 'free' then false
        when exists (
          select 1
          from subscriptions sub
          join plans p on p.id = sub.plan_id
          where sub.user_id = auth.uid()
            and sub.status in ('trialing', 'active')
            and p.slug = 'resident'
        ) then false
        else true
      end as locked
    from s
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
      'audio',           (
        select json_build_object(
          'storage_path', au.storage_path,
          'narrator',     au.narrator
        )
        from story_audio au
        where au.story_id = s.id
        limit 1
      )
    )
    from s, access
  ) end;
$$;

comment on function public.story_for_reader(text) is
  'A story, its shelf, its narration and its body if this reader may have it — in one request. Same withholding rule as story_body().';

grant execute on function public.story_for_reader(text) to anon, authenticated;
