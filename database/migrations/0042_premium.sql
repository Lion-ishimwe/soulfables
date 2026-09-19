-- =====================================================================
-- Soulfables — 0042 Premium
--
-- The two tiers as the House now names them: Free and Premium. The
-- plan slugs stay ('free', 'resident') because every rule in the
-- database reads them; only what a reader is shown changes.
--
-- Three new things the tiers need:
--
--   1. A price. plan_prices gets a monthly and a yearly row for Premium,
--      in USD, with room for the PayPal plan ids that Settings →
--      Membership fills in once the plans exist on PayPal's side.
--   2. An allowance. A Free reader may listen to a handful of narrated
--      stories a month — five, by default, kept in house_settings so the
--      House can change its mind. narration_listens counts them, one
--      row per reader, story and month, so listening to the same story
--      twice costs one.
--   3. Early access. A story with status 'scheduled' is readable by
--      Premium readers and staff before its day comes.
--
-- story_for_reader() and narration_for_reader() are rewritten to apply
-- all three, and to say WHY a narration is withheld — premium, sign in,
-- or allowance spent — so the page can tell the reader rather than show
-- them nothing.
-- =====================================================================

update plans set name = 'Free',
  description = 'The library, the journal, the mood tracker, five narrated stories a month, and a line a day.'
  where slug = 'free';
update plans set name = 'Premium',
  description = 'Everything in the House: every story and narration, the generated companion, guided journals, sleep stories, early access, and your own theme.'
  where slug = 'resident';

insert into plan_prices (plan_id, currency, unit_amount, interval, provider, is_default, is_active)
select p.id, 'USD', v.amount, v.interval, 'paypal', v.is_default, true
from plans p
join (values (799, 'month', true), (6900, 'year', false)) as v(amount, interval, is_default) on true
where p.slug = 'resident'
  and not exists (
    select 1 from plan_prices pp where pp.plan_id = p.id and pp.interval = v.interval
  );

alter table house_settings
  add column if not exists free_audio_per_month integer not null default 5;
comment on column house_settings.free_audio_per_month is
  'How many different narrated stories a Free reader may listen to in a calendar month. Settings → Membership.';

-- ---------------------------------------------------------------------
-- What a Free reader has listened to this month.
-- ---------------------------------------------------------------------
create table if not exists narration_listens (
  user_id   uuid not null references auth.users(id) on delete cascade,
  story_id  uuid not null references stories(id) on delete cascade,
  month     date not null,
  first_at  timestamptz not null default now(),
  primary key (user_id, story_id, month)
);
comment on table narration_listens is
  'One row per reader, story and month: the Free allowance. Written by the audio route with the service role.';

alter table narration_listens enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'narration_listens' and policyname = 'narration_listens_own_read') then
    create policy narration_listens_own_read on narration_listens
      for select using (user_id = auth.uid() or is_staff());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Who is asking, in one place: staff, premium, signed in, and how many
-- different stories they have listened to this month.
-- ---------------------------------------------------------------------
create or replace function public.reader_standing()
returns table (staff boolean, premium boolean, signed_in boolean, listens integer, allowance integer)
language sql
stable
security definer
set search_path = public
as $$
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
    ) as premium,
    auth.uid() is not null as signed_in,
    (
      select count(*)::integer from narration_listens nl
      where nl.user_id = auth.uid() and nl.month = date_trunc('month', now())::date
    ) as listens,
    coalesce((select free_audio_per_month from house_settings where id = 1), 5) as allowance;
$$;
grant execute on function public.reader_standing() to anon, authenticated;

-- ---------------------------------------------------------------------
-- The story page's one question, now with early access and the
-- narration's reason.
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
    select *
    from stories, who
    where slug = p_slug
      and (
        status = 'published'
        or (status = 'scheduled' and (who.staff or who.premium))
        or who.staff
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
      case
        when who.staff then false
        when s.access = 'free' then false
        when who.premium then false
        else true
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
      'access',          s.access,
      'cover_image',     s.cover_image,
      'status',          s.status,
      'early_access',    (s.status = 'scheduled'),
      'scheduled_for',   s.scheduled_for,
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
            when au.access = 'premium' then 'premium'
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

comment on function public.story_for_reader(text) is
  'A story, its shelf, its narration (with whether and why this reader may not hear it) and its body if this reader may have it — in one request. Scheduled stories open early for Premium.';

-- ---------------------------------------------------------------------
-- The narration route's question, by the same rule. count_listen says
-- whether hearing it should use one of a Free reader's allowance.
-- ---------------------------------------------------------------------
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
        when au.access = 'premium' then true
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
    (not who.staff and not who.premium and au.access = 'free' and who.signed_in) as count_listen,
    au.story_id
  from story_audio au
  join stories s on s.id = au.story_id
  cross join who
  where s.slug = p_slug
    and (s.status = 'published' or (s.status = 'scheduled' and (who.staff or who.premium)) or who.staff)
  order by au.created_at desc
  limit 1;
$$;

comment on function public.narration_for_reader(text) is
  'The narration file for a story, whether the caller may hear it, and whether hearing it counts against the Free allowance.';

grant execute on function public.narration_for_reader(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Early access: the scheduled stories, for Premium readers and staff.
-- Empty for everyone else, so the page has nothing to hide.
-- ---------------------------------------------------------------------
create or replace function public.early_access_stories()
returns table (
  id uuid, slug text, title text, subtitle text, reading_minutes integer,
  access access_level, cover_image text, author_name text, shelf_slug text,
  scheduled_for timestamptz, has_audio boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with who as (select * from reader_standing())
  select
    s.id, s.slug, s.title, s.subtitle, s.reading_minutes, s.access, s.cover_image,
    (select a.name from authors a where a.id = s.author_id) as author_name,
    (
      select sh.slug from story_shelves ss join shelves sh on sh.id = ss.shelf_id
      where ss.story_id = s.id order by ss.is_primary desc, ss.sort_order limit 1
    ) as shelf_slug,
    s.scheduled_for,
    exists (select 1 from story_audio au where au.story_id = s.id) as has_audio
  from stories s, who
  where s.status = 'scheduled'
    and (who.staff or who.premium)
  order by s.scheduled_for nulls last, s.created_at desc;
$$;

grant execute on function public.early_access_stories() to anon, authenticated;
