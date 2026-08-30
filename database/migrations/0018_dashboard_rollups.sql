-- =====================================================================
-- Soulfables — 0018 Rollups, for latency
--
-- The database is in Frankfurt and the House is not. A round trip costs
-- roughly 300ms regardless of what it asks for — a count of one row and
-- a join across twelve stories are within 20ms of each other. So page
-- time is set by the NUMBER of queries, not their cost.
--
-- The dashboard was making about two dozen. Twelve of them were counts,
-- each a separate request over the same connection to ask a question the
-- database can answer twelve at a time.
--
-- These functions do not make any single query faster. They make there
-- be fewer of them, which is the only thing that helps from this far
-- away.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Every number in the stat row, plus the previous window each one is
-- compared against. One request instead of twelve.
-- ---------------------------------------------------------------------
create or replace function public.dashboard_counts(p_days integer default 30)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not is_staff() then null
    else json_build_object(
      'published',       (select count(*) from stories  where status = 'published'),
      'drafts',          (select count(*) from stories  where status = 'draft'),
      'stories',         (select count(*) from stories),
      'products',        (select count(*) from products where status = 'published'),
      'orders',          (select count(*) from orders   where status = 'paid'),
      'readers',         (select count(*) from profiles),

      -- The two windows a trend compares: the last p_days, and the
      -- p_days before those.
      'orders_recent',   (select count(*) from orders   where status = 'paid'
                            and paid_at >= now() - make_interval(days => p_days)),
      'orders_prior',    (select count(*) from orders   where status = 'paid'
                            and paid_at >= now() - make_interval(days => p_days * 2)
                            and paid_at <  now() - make_interval(days => p_days)),
      'readers_recent',  (select count(*) from profiles
                            where created_at >= now() - make_interval(days => p_days)),
      'readers_prior',   (select count(*) from profiles
                            where created_at >= now() - make_interval(days => p_days * 2)
                            and created_at <  now() - make_interval(days => p_days)),
      'published_recent',(select count(*) from stories where status = 'published'
                            and published_at >= now() - make_interval(days => p_days)),
      'published_prior', (select count(*) from stories where status = 'published'
                            and published_at >= now() - make_interval(days => p_days * 2)
                            and published_at <  now() - make_interval(days => p_days))
    )
  end;
$$;

comment on function public.dashboard_counts(integer) is
  'Every stat-row number in one request. Staff only; returns null to anyone else.';

grant execute on function public.dashboard_counts(integer) to authenticated;

-- ---------------------------------------------------------------------
-- The four chart metrics, already bucketed by day.
--
-- Bucketing here rather than in JavaScript means the wire carries thirty
-- numbers instead of every raw timestamp — and, more to the point, it is
-- one request rather than four.
-- ---------------------------------------------------------------------
create or replace function public.dashboard_series(p_days integer default 30)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date,
      interval '1 day'
    )::date as day
  ),
  opens as (
    select created_at::date as day, count(*) as n
    from analytics_events
    where event_name = 'story_opened'
      and created_at >= current_date - (p_days - 1)
    group by 1
  ),
  readers as (
    select created_at::date as day, count(*) as n
    from profiles
    where created_at >= current_date - (p_days - 1)
    group by 1
  ),
  orders as (
    select paid_at::date as day, count(*) as n
    from orders
    where status = 'paid' and paid_at >= current_date - (p_days - 1)
    group by 1
  ),
  published as (
    select published_at::date as day, count(*) as n
    from stories
    where status = 'published' and published_at >= current_date - (p_days - 1)
    group by 1
  )
  select case
    when not is_staff() then null
    else json_build_object(
      'days',      (select json_agg(to_char(day, 'YYYY-MM-DD') order by day) from days),
      'opens',     (select json_agg(coalesce(o.n, 0) order by d.day) from days d left join opens o using (day)),
      'readers',   (select json_agg(coalesce(r.n, 0) order by d.day) from days d left join readers r using (day)),
      'orders',    (select json_agg(coalesce(o.n, 0) order by d.day) from days d left join orders o using (day)),
      'published', (select json_agg(coalesce(p.n, 0) order by d.day) from days d left join published p using (day))
    )
  end;
$$;

comment on function public.dashboard_series(integer) is
  'Four metrics, thirty days, one request. Bucketed in the database. Staff only.';

grant execute on function public.dashboard_series(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Who is reading, in one request.
--
-- getViewer() ran three: getUser() against the auth server, then
-- profiles, then user_roles. The first is not negotiable — it verifies
-- the token rather than trusting the cookie — but the other two are one
-- question about one person and were two round trips.
-- ---------------------------------------------------------------------
create or replace function public.viewer_context()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'display_name', (select display_name from profiles  where id = auth.uid()),
    'role',         (select role::text   from user_roles where user_id = auth.uid())
  )
  where auth.uid() is not null;
$$;

comment on function public.viewer_context() is
  'A signed-in reader''s display name and role together. Scoped to the caller.';

grant execute on function public.viewer_context() to authenticated;
