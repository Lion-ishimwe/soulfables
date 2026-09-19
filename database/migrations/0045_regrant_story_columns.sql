-- =====================================================================
-- Soulfables — 0045 Re-grant the story columns
--
-- 0043 added stories.for_sleep and did not re-run grant_story_columns().
-- The stories table is granted column by column (0015: body_mdx is
-- withheld that way), so a new column is unreadable by the site until
-- the grant is re-applied — and PostgREST refuses the whole select,
-- which emptied the library. This does what 0043 should have, and it
-- is the rule from here on: any migration that adds a column to
-- stories ends with the same line.
-- =====================================================================

select public.grant_story_columns();
