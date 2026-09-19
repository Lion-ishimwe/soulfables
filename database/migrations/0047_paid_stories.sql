-- =====================================================================
-- Soulfables — 0047 Stories for sale
--
-- A story marked 'paid' is a book: the admin gives it a price on the
-- story's own page and the House makes a product of it in the Bookshop,
-- linked through product_stories. Reading it takes one of three things:
-- staff, Premium, or an entitlement — which a purchase grants through
-- grant_entitlements_for_order() and a refund revokes. The story page
-- learns whether this reader owns it and, if not, what it costs and
-- where to buy it. Its narration follows the same rule.
-- =====================================================================

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
  owned as (
    select exists (
      select 1
      from entitlements e
      join product_stories ps on ps.product_id = e.product_id
      cross join s
      where e.user_id = auth.uid()
        and ps.story_id = s.id
        and e.revoked_at is null
        and (e.expires_at is null or e.expires_at > now())
    ) as yes
  ),
  access as (
    select
      s.id,
      case
        when who.staff then false
        when who.premium then false
        when s.access = 'premium' then true
        when s.series_access = 'premium' then true
        when s.access = 'paid' then not owned.yes
        else false
      end as locked
    from s, who, owned
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
      'owned',           owned.yes,
      'product',         (
        select json_build_object('slug', p.slug, 'unit_amount', pp.unit_amount, 'currency', pp.currency)
        from product_stories ps
        join products p on p.id = ps.product_id
        left join product_prices pp on pp.product_id = p.id and pp.is_default and pp.is_active
        where ps.story_id = s.id and p.status = 'published'
        order by ps.sort_order
        limit 1
      ),
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
        from story_audio au, who, heard, owned,
        lateral (
          select case
            when who.staff or who.premium then null
            when s.access = 'paid' and not owned.yes then 'paid'
            when au.access = 'premium' or s.for_sleep or s.series_access = 'premium' then 'premium'
            when s.access = 'paid' then null
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
    from s, access, who, owned
  ) end;
$$;

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
        when s.access = 'paid' then not exists (
          select 1 from entitlements e join product_stories ps on ps.product_id = e.product_id
          where e.user_id = auth.uid() and ps.story_id = s.id and e.revoked_at is null
            and (e.expires_at is null or e.expires_at > now())
        )
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
    (not who.staff and not who.premium and au.access = 'free' and s.access <> 'paid' and not s.for_sleep and coalesce(se.access, 'free') = 'free' and who.signed_in) as count_listen,
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
