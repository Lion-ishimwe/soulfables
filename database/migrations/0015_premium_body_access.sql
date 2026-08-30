-- =====================================================================
-- Soulfables — 0015 Premium body access
--
-- Closing a hole that only appeared once the schema met a real
-- PostgREST: the full text of a PREMIUM story was readable by anyone
-- holding the anon key, which is public by design and shipped in the
-- client bundle.
--
--   curl "$URL/rest/v1/stories?slug=eq.letters-to-the-tide&select=body_mdx"
--
-- returned 1,833 characters of paid prose. The application layer was
-- never at fault — getStory() withholds the body and the page renders a
-- wall — but the application was the only thing enforcing it, and the
-- API sits underneath the application.
--
-- That contradicts the claim this whole build rests on: that
-- entitlements are the sole source of access, checked by the database
-- rather than by the page.
--
-- The fix is column-level. The row stays readable, because listings,
-- search and the paywall itself all need the row; only body_mdx stops
-- being selectable, and the body is served instead by a function that
-- asks who is reading.
--
-- Why not move bodies to their own table: search_vector is a generated
-- column over body_mdx, so the column has to stay where it is. Column
-- privileges express exactly what is needed and nothing more.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Nobody selects this column directly any more.
--
-- The mechanism matters, and the obvious version does not work:
--
--   revoke select (body_mdx) on stories from anon;   -- does NOTHING
--
-- A column-level revoke only removes column-level grants. It cannot
-- subtract a column from a table-level `grant select on stories`, which
-- is exactly what anon and authenticated hold on a Supabase project. The
-- statement succeeds, changes nothing, and leaves you believing the hole
-- is closed.
--
-- So: drop the table-level grant, then grant back every column except
-- the one being protected.
--
-- Safe because every query in the application names its columns; there
-- is no `select *` on stories to break. A new one would fail loudly at
-- the first request rather than quietly leaking.
-- ---------------------------------------------------------------------
create or replace function public.grant_story_columns()
returns void
language plpgsql
as $$
declare
  v_cols text;
begin
  revoke select on stories from anon, authenticated;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'stories'
    and column_name <> 'body_mdx';

  execute format('grant select (%s) on stories to anon, authenticated', v_cols);
end
$$;

comment on function public.grant_story_columns() is
  'Re-applies the stories column grants. Run after anything that issues a blanket GRANT SELECT, which silently restores access to body_mdx.';

select public.grant_story_columns();

-- ---------------------------------------------------------------------
-- The one way in.
--
-- SECURITY DEFINER, so it can read the column its callers cannot, and it
-- answers only for a story the caller is allowed to read the body of:
--
--   free and published    anyone, including a stranger
--   premium and published a resident subscription, active or trialing
--   any status            staff, who have to be able to edit it
--
-- Returns null rather than raising when the answer is no. A reader
-- hitting the paywall is an ordinary state, not an error, and the page
-- already knows how to render it.
-- ---------------------------------------------------------------------
create or replace function public.story_body(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.body_mdx
  from stories s
  where s.slug = p_slug
    and (
      -- Staff read anything, at any status, because they write it.
      is_staff()

      -- An author reads what they are currently assigned to write.
      or exists (
        select 1 from authors a
        where a.id = s.assigned_author_id
          and a.user_id = auth.uid()
      )

      -- Everyone else needs the story to be published first.
      or (
        s.status = 'published'
        and (
          s.access = 'free'
          or exists (
            select 1
            from subscriptions sub
            join plans p on p.id = sub.plan_id
            where sub.user_id = auth.uid()
              and sub.status in ('trialing', 'active')
              and p.slug = 'resident'
          )
        )
      )
    );
$$;

comment on function public.story_body(text) is
  'The only path to a story body. Column select on stories.body_mdx is revoked; this checks who is asking.';

grant execute on function public.story_body(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Known and accepted: search_vector still includes body_mdx at weight D,
-- so a full-text search can match words that occur only in premium
-- prose. That reveals whether a phrase appears, never the prose itself.
-- Removing it would make search markedly worse for the subscribers who
-- are paying, to close a channel that returns one bit at a time.
-- ---------------------------------------------------------------------
