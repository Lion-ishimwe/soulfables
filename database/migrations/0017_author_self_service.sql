-- =====================================================================
-- Soulfables — 0017 Author self-service
--
-- An author can now change their own biography. They could not before:
-- the only write policy on `authors` is is_staff(), so the person whose
-- name is on the page had to ask somebody else to fix their own
-- description of themselves.
--
-- Why a function rather than a policy.
--
-- The obvious version is a second UPDATE policy on authors, scoped to
-- `user_id = auth.uid()`. That grants the row, and Postgres has no way
-- to say "this row, but only these columns" from inside a policy — an
-- UPDATE policy's WITH CHECK cannot see the old row, so it cannot
-- require that name and slug were left alone. The author would be able
-- to rename themselves, change their URL, mark themselves a House voice
-- or reorder the author list.
--
-- Column-level grants would express it, but `authenticated` holds the
-- table-level UPDATE that staff rely on, and revoking that to grant
-- columns back would take the admin down with it.
--
-- So: one function, one column, and the ownership check written where it
-- can be read.
-- =====================================================================

create or replace function public.update_own_author_bio(p_bio text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bio text;
begin
  -- Trim to nothing rather than storing a string of spaces, and treat an
  -- empty biography as absent so the page falls back to the name alone.
  v_bio := nullif(btrim(coalesce(p_bio, '')), '');

  if length(v_bio) > 2000 then
    raise exception 'A biography of more than 2000 characters is a story, not a biography.';
  end if;

  update authors
     set bio = v_bio,
         updated_at = now()
   where user_id = auth.uid();

  if not found then
    raise exception 'You do not have an author page to edit.';
  end if;

  return v_bio;
end
$$;

comment on function public.update_own_author_bio(text) is
  'Lets an author edit their own biography and nothing else. Scoped to the caller''s own row.';

grant execute on function public.update_own_author_bio(text) to authenticated;

-- ---------------------------------------------------------------------
-- The author's own record, for the writing room.
--
-- authors is publicly readable, so this exists for convenience rather
-- than for secrecy: it answers "which author am I" without the caller
-- needing to know their own author id.
-- ---------------------------------------------------------------------
create or replace function public.my_author()
returns table (slug text, name text, bio text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select a.slug, a.name, a.bio, a.avatar_url
  from authors a
  where a.user_id = auth.uid();
$$;

grant execute on function public.my_author() to authenticated;
