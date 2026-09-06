-- =====================================================================
-- Soulfables — 0027 Exactly the themes each story should carry
--
-- 0026 removed the six doorway words and inserted the right pairs, but it
-- inserted them alongside whatever had survived rather than in place of
-- it. Six themes were untouched by that delete — Identity, Self-worth,
-- Family, Nostalgia, Purpose, Growth — so any story already carrying one
-- kept it and gained two more:
--
--   The Map Without My Home   Identity, Belonging, Nostalgia, Home
--
-- Four themes is not a card, it is a list. The intent was two.
--
-- Growth goes too. It survived because it collides with no shelf, but it
-- says the same thing as Becoming, and two words for one idea is how a
-- controlled vocabulary stops being controlled.
-- =====================================================================

delete from themes where slug = 'growth';

-- ---------------------------------------------------------------------
-- Set, rather than add.
--
-- Clearing first is what 0026 should have done. Doing it only for the
-- stories named below leaves anything tagged since then alone, rather
-- than reaching across the whole table to fix eleven rows.
-- ---------------------------------------------------------------------
with intended (story_slug, theme_a, theme_b) as (values
  ('the-house-after-you-left',           'home',       'memory'),
  ('the-stranger-in-my-mirror',          'identity',   'self-worth'),
  ('the-sister-who-left-and-returned',   'family',     'return'),
  ('the-map-without-my-home',            'home',       'belonging'),
  ('the-name-i-left-behind',             'identity',   'becoming'),
  ('the-last-voice-note',                'memory',     'letting-go'),
  ('the-garden-remembered-me',           'motherhood', 'memory'),
  ('the-voice-in-the-river',             'purpose',    'faith'),
  ('the-light-that-outlasted',           'devotion',   'memory'),
  ('the-seed-i-was-afraid-to-plant',     'becoming',   'purpose'),
  ('the-house-that-burned-without-fire', 'home',       'silence')
)
delete from story_themes st
using stories s, intended i
where st.story_id = s.id
  and s.slug = i.story_slug;

with intended (story_slug, theme_a, theme_b) as (values
  ('the-house-after-you-left',           'home',       'memory'),
  ('the-stranger-in-my-mirror',          'identity',   'self-worth'),
  ('the-sister-who-left-and-returned',   'family',     'return'),
  ('the-map-without-my-home',            'home',       'belonging'),
  ('the-name-i-left-behind',             'identity',   'becoming'),
  ('the-last-voice-note',                'memory',     'letting-go'),
  ('the-garden-remembered-me',           'motherhood', 'memory'),
  ('the-voice-in-the-river',             'purpose',    'faith'),
  ('the-light-that-outlasted',           'devotion',   'memory'),
  ('the-seed-i-was-afraid-to-plant',     'becoming',   'purpose'),
  ('the-house-that-burned-without-fire', 'home',       'silence')
)
insert into story_themes (story_id, theme_id)
select s.id, t.id
from intended i
join stories s on s.slug = i.story_slug
join themes  t on t.slug in (i.theme_a, i.theme_b)
on conflict (story_id, theme_id) do nothing;
