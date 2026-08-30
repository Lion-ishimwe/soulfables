-- =====================================================================
-- Soulfables — 0016 Author accounts
--
-- The admin needs to answer "does this author have a way in, and since
-- when" — and the answer lives in auth.users, which PostgREST does not
-- expose and should not. So the Authors page was reading the demo
-- fixtures instead, in live mode, and showing invented emails and dates
-- beside real authors.
--
-- Same shape as story_body() in 0015: a SECURITY DEFINER function that
-- reads what its callers cannot, and answers only for people who are
-- allowed to ask.
-- =====================================================================

create or replace function public.author_accounts()
returns table (
  author_slug text,
  author_name text,
  email       text,
  invited_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.slug,
    a.name,
    u.email::text,
    -- invited_at is set when an invitation is sent. An account created
    -- directly (the founder's own, for instance) has none, so fall back
    -- to when the account itself came into existence — which is the
    -- honest answer to "since when" either way.
    coalesce(a.invited_at, u.created_at)
  from authors a
  join auth.users u on u.id = a.user_id
  -- Staff only. Without this, any signed-in reader could enumerate the
  -- email address of every author in the House.
  where is_staff();
$$;

comment on function public.author_accounts() is
  'Which authors can sign in, and since when. Staff only — reads auth.users, which is not exposed to the API.';

grant execute on function public.author_accounts() to authenticated;
