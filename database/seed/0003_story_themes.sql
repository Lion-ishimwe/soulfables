-- =====================================================================
-- Soulfables — seed 0003: what each story is about
--
-- A shelf is where a story lives; a theme is what it is about. They are
-- not the same, and after migration 0026 they may not even share a word:
-- a trigger on both tables refuses it.
--
-- So no story here carries a theme that repeats its own shelf. "The House
-- After You Left" sits on Heartbreak and is about Home and Memory — which
-- tells a reader something the shelf did not.
--
-- Two themes each: enough to say what somebody is walking into, few
-- enough that the card stays a card.
--
-- Idempotent. Run it as often as you like.
-- =====================================================================

insert into story_themes (story_id, theme_id)
select s.id, t.id
from (values
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
) as v(story_slug, theme_a, theme_b)
join stories s on s.slug = v.story_slug
join themes  t on t.slug in (v.theme_a, v.theme_b)
on conflict (story_id, theme_id) do nothing;
