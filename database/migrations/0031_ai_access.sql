-- =====================================================================
-- Soulfables — 0031 Who may use the writing assistant
--
-- The assistant costs money on every call and writes in the House's
-- voice, so whether an author may use it is the House's decision, made
-- per author, by staff. Staff always may: it is their budget.
--
-- One column on authors, off by default. A new author gets a desk and
-- no assistant until somebody in Settings → Access switches it on —
-- the same way they got the desk in the first place.
-- =====================================================================

alter table authors
  add column if not exists ai_access boolean not null default false;

comment on column authors.ai_access is
  'Whether this author may use the writing assistant (Ask AI, concepts, drafts). Staff always may. Set from Settings → Access.';

-- ---------------------------------------------------------------------
-- The rule, as one function, so the application asks one question.
-- Mirrors is_staff(): the caller's own identity, nothing passed in.
-- ---------------------------------------------------------------------
create or replace function public.writing_ai_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_staff()
      or exists (
           select 1 from authors a
            where a.user_id = auth.uid()
              and a.ai_access
         );
$$;

comment on function public.writing_ai_allowed() is
  'True for staff, and for authors whose ai_access is on. The one place the writing assistant asks whether it may answer.';

grant execute on function public.writing_ai_allowed() to authenticated;

-- ---------------------------------------------------------------------
-- The accounts list gains the flag, so Settings → Access can show it
-- beside the address. A return type cannot change in place, so the
-- function is dropped and made again with the same body plus one column.
-- ---------------------------------------------------------------------
drop function if exists public.author_accounts();

create function public.author_accounts()
returns table (
  author_slug text,
  author_name text,
  email       text,
  invited_at  timestamptz,
  ai_access   boolean
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
    coalesce(a.invited_at, u.created_at),
    a.ai_access
  from authors a
  join auth.users u on u.id = a.user_id
  where is_staff();
$$;

comment on function public.author_accounts() is
  'Which authors can sign in, since when, and whether they may use the writing assistant. Staff only — reads auth.users, which is not exposed to the API.';

grant execute on function public.author_accounts() to authenticated;
