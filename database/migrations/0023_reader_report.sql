-- =====================================================================
-- Soulfables — 0023 The reader list, for the report
--
-- The Readers page has always rendered a fixture: seven invented people
-- with invented emails and invented reading counts. Merging it into the
-- report without giving it a real source would just move the fiction to
-- a new address.
--
-- A reader's email lives in auth.users, which PostgREST does not expose
-- and should not — so this is the same shape as author_accounts() in
-- 0016: SECURITY DEFINER, reading what its callers cannot, gated on
-- is_staff(). Without that gate any signed-in reader could enumerate
-- every address in the House.
-- =====================================================================

create or replace function public.reader_report()
returns table (
  user_id      uuid,
  display_name text,
  email        text,
  role         text,
  plan         text,
  joined_at    timestamptz,
  stories_read bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    u.email::text,
    coalesce(r.role::text, 'reader'),

    -- A resident is somebody with a live subscription, not somebody who
    -- once had one. Anything lapsed reads as free, which is what it is.
    case
      when exists (
        select 1
        from subscriptions s
        join plans pl on pl.id = s.plan_id
        where s.user_id = p.id
          and s.status in ('trialing', 'active')
          and pl.slug = 'resident'
      ) then 'resident'
      else 'free'
    end,

    p.created_at,

    -- Finished, not opened. Somebody who opened forty stories and
    -- finished two has read two.
    (select count(*) from reading_progress rp
      where rp.user_id = p.id and rp.completed_at is not null)
  from profiles p
  join auth.users u on u.id = p.id
  left join user_roles r on r.user_id = p.id
  where is_staff()
  order by p.created_at desc;
$$;

comment on function public.reader_report() is
  'Everyone with an account, for the report. Staff only — it reads auth.users.';

grant execute on function public.reader_report() to authenticated;
