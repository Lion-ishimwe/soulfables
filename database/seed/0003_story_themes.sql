-- =====================================================================
-- Soulfables — seed 0003: what each story is about
--
-- themes has been seeded since 0003_taxonomy and story_themes has been
-- empty since the day it was created, so every card that wanted to say
-- what a story is about had nothing to say.
--
-- A shelf is where a story lives; a theme is what it is about. They are
-- not the same and a story usually carries two — enough to tell a reader
-- what they are walking into, few enough that the card stays a card.
--
-- Idempotent. Run it as often as you like.
-- =====================================================================

insert into story_themes (story_id, theme_id)
select s.id, t.id
from (values
  ('the-garden-remembered-me',          'healing',     'growth'),
  ('the-house-after-you-left',          'grief',       'nostalgia'),
  ('the-house-that-burned-without-fire','heartbreak',  'healing'),
  ('the-last-voice-note',               'grief',       'love'),
  ('the-light-that-outlasted',          'hope',        'healing'),
  ('the-map-without-my-home',           'identity',    'nostalgia'),
  ('the-name-i-left-behind',            'identity',    'growth'),
  ('the-seed-i-was-afraid-to-plant',    'hope',        'growth'),
  ('the-sister-who-left-and-returned',  'family',      'forgiveness'),
  ('the-stranger-in-my-mirror',         'identity',    'self-worth'),
  ('the-voice-in-the-river',            'purpose',     'healing')
) as v(story_slug, theme_a, theme_b)
join stories s on s.slug = v.story_slug
join themes  t on t.slug in (v.theme_a, v.theme_b)
on conflict (story_id, theme_id) do nothing;
