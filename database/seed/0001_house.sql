-- =====================================================================
-- Soulfables — Seed: the House as it stands today
--
-- Transcribed from the live site so the new platform starts with the real
-- taxonomy rather than lorem ipsum. Story bodies are NOT seeded here —
-- those are content, and they come across in the migration script
-- (scripts/import-legacy.ts) with their MDX intact.
--
-- Safe to re-run: every insert is idempotent on its natural key.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Authors. "The Librarian" is the House voice, not a person.
-- ---------------------------------------------------------------------
insert into authors (slug, name, bio, is_persona, sort_order) values
  ('apophia-kamwine', 'Apophia Kamwine',
   'Founder of Soulfables. Writes modern folktales about love, loss, and becoming.',
   false, 0),
  ('the-librarian', 'The Librarian',
   'The keeper of the House. Chooses what you read before you know you need it.',
   true, 1),
  ('seren-adair', 'Seren Adair', null, false, 2),
  ('caelum-orr', 'Caelum Orr', null, false, 3)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Themes — the filter row on the Library page.
-- ---------------------------------------------------------------------
insert into themes (slug, label, sort_order) values
  ('heartbreak',  'Heartbreak',  0),
  ('healing',     'Healing',     1),
  ('identity',    'Identity',    2),
  ('grief',       'Grief',       3),
  ('hope',        'Hope',        4),
  ('forgiveness', 'Forgiveness', 5),
  ('growth',      'Growth',      6),
  ('self-worth',  'Self Worth',  7),
  ('family',      'Family',      8),
  ('love',        'Love',        9),
  ('purpose',     'Purpose',    10),
  ('nostalgia',   'Nostalgia',  11)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Shelves — the Library of Feelings.
--
-- Note slug vs label: the shelf a reader knows as "Sleepless" lives at
-- /shelf/anxiety, and "New Beginnings" at /shelf/change. Those URLs are
-- already indexed, so the slugs are preserved exactly and the label is
-- free to change.
-- ---------------------------------------------------------------------
insert into shelves (slug, label, title, emoji, tagline, status, sort_order) values
  ('heartbreak', 'Heartbreak', 'Stories About Heartbreak', '❤️',
   'Love, loss, and the slow art of letting go.', 'published', 0),
  ('healing', 'Healing', 'Stories About Healing', '🌿',
   'The quiet work that happens after the worst of it.', 'published', 1),
  ('anxiety', 'Sleepless', 'Stories for the Sleepless', '🌙',
   'For the nights the mind will not put itself down.', 'published', 2),
  ('change', 'New Beginnings', 'Stories About Beginning Again', '🌊',
   'What it costs to start, and what it gives back.', 'published', 3),
  ('love', 'Love', 'Stories About Love', '💛',
   'In all the shapes it arrives in.', 'published', 4),
  ('loneliness', 'Loneliness', 'Stories About Loneliness', '🕯️',
   'Company for the hours that have none.', 'published', 5),
  ('grief', 'Grief', 'Stories About Grief', '🕊️',
   'For what stays after someone goes.', 'published', 6),
  ('hope', 'Hope', 'Stories About Hope', '✨',
   'Quiet, stubborn, and usually early.', 'published', 7),
  ('forgiveness', 'Forgiveness', 'Stories About Forgiveness', '🤍',
   'Including the hardest one, which is yourself.', 'published', 8)
on conflict (slug) do nothing;

-- The Librarian's note on the Heartbreak shelf, verbatim from the site.
update shelves set librarian_note =
  'Stay as long as you need. But don''t forget the Healing shelf exists — readers rarely stay here forever. They usually leave carrying Hope.'
where slug = 'heartbreak';

-- ---------------------------------------------------------------------
-- The journey graph — "Readers usually come here from / continue to".
-- Editorial edges for now (is_editorial = true). Once there is enough
-- reading data, a scheduled job recomputes `weight` and flips the flag;
-- the UI does not change.
-- ---------------------------------------------------------------------
insert into shelf_journeys (shelf_id, related_shelf_id, direction, sort_order)
select s.id, r.id, d.direction, d.ord
from (values
  ('heartbreak', 'grief',       'arrives_from', 0),
  ('heartbreak', 'love',        'arrives_from', 1),
  ('heartbreak', 'loneliness',  'arrives_from', 2),
  ('heartbreak', 'healing',     'continues_to', 0),
  ('heartbreak', 'hope',        'continues_to', 1),
  ('heartbreak', 'forgiveness', 'continues_to', 2),
  ('grief',      'heartbreak',  'continues_to', 0),
  ('grief',      'healing',     'continues_to', 1),
  ('healing',    'heartbreak',  'arrives_from', 0),
  ('healing',    'grief',       'arrives_from', 1),
  ('healing',    'hope',        'continues_to', 0),
  ('healing',    'change',      'continues_to', 1),
  ('loneliness', 'heartbreak',  'continues_to', 0),
  ('loneliness', 'hope',        'continues_to', 1),
  ('anxiety',    'healing',     'continues_to', 0),
  ('change',     'hope',        'continues_to', 0)
) as d(shelf_slug, related_slug, direction, ord)
join shelves s on s.slug = d.shelf_slug
join shelves r on r.slug = d.related_slug
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Moods — the journal's "HOW ARE YOU FEELING?" row, each bridged to the
-- shelf it most naturally opens onto.
-- ---------------------------------------------------------------------
insert into moods (slug, label, emoji, shelf_id, sort_order)
select m.slug, m.label, m.emoji, s.id, m.ord
from (values
  ('heartbroken', 'Heartbroken', '❤️',  'heartbreak',  0),
  ('healing',     'Healing',     '🌿',  'healing',     1),
  ('lost',        'Lost',        '🌙',  'anxiety',     2),
  ('grieving',    'Grieving',    '🕊️', 'grief',       3),
  ('hopeful',     'Hopeful',     '✨',  'hope',        4),
  ('unsure',      'Unsure',      '🪞',  null,          5)
) as m(slug, label, emoji, shelf_slug, ord)
left join shelves s on s.slug = m.shelf_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Journal prompts — a starter pool. `scheduled_on` is null, so these are
-- drawn from at random until the House schedules specific days.
-- ---------------------------------------------------------------------
insert into journal_prompts (body, kind) values
  ('What part of yourself are you making peace with?', 'daily'),
  ('What is the smallest thing that mends a hole in a heart?', 'daily'),
  ('Who are you still writing letters to in your head?', 'daily'),
  ('What did today ask of you that yesterday could not?', 'daily'),
  ('What are you carrying that was never yours to hold?', 'daily')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- The shop, as it stands.
-- ---------------------------------------------------------------------
insert into products (slug, title, subtitle, kind, eyebrow, pull_quote, cta_label, status, is_featured, sort_order, author_id)
select p.slug, p.title, p.subtitle, p.kind::product_kind, p.eyebrow, p.pull_quote, p.cta, 'published', p.featured, p.ord, a.id
from (values
  ('the-version-of-me-you-broke', 'The Version Of Me You Broke',
   'A Soulfables Original by Apophia Kamwine', 'ebook',
   'SOULFABLES ORIGINAL · NEW RELEASE',
   'You didn''t lose yourself forever. You were waiting to come home.',
   'COME HOME TO YOURSELF', true, 0, 'apophia-kamwine'),
  ('the-soulfables-library', 'The Soulfables Library',
   'Your Complete Sanctuary', 'bundle',
   'THE LIBRARIAN''S COLLECTION',
   'Every story, every journal, every reflection — kept together in one library.',
   'EXPLORE THE COMPLETE LIBRARY', false, 1, null),
  ('heartbreak-anthology', 'Heartbreak Anthology',
   'Stories for the Aftermath', 'anthology',
   'YOUR SIGNATURE COLLECTION',
   'The collection that introduced thousands of readers to Soulfables.',
   'BEGIN WITH HEARTBREAK', false, 2, 'apophia-kamwine'),
  ('the-soul-journal', 'The Soul Journal',
   'A Companion for Quiet Reflection', 'journal',
   'THE EVERYDAY COMPANION',
   'A quiet place to write after every story.',
   'START WRITING', false, 3, null),
  ('the-reflection-deck', 'The Reflection Deck',
   'Questions for the Quiet Moments', 'deck',
   'THE GIFTABLE EXPERIENCE',
   '52 questions for the moments that ask something of you.',
   'DRAW YOUR FIRST CARD', false, 4, null)
) as p(slug, title, subtitle, kind, eyebrow, pull_quote, cta, featured, ord, author_slug)
left join authors a on a.slug = p.author_slug
on conflict (slug) do nothing;

-- Prices in minor units. USD is the default presentment currency; the
-- schema is multi-currency from the start because a Rwanda-based House
-- selling to a global diaspora will need at least one more.
insert into product_prices (product_id, currency, unit_amount, is_default)
select pr.id, v.currency, v.amount, true
from (values
  ('the-version-of-me-you-broke', 'USD',  799),
  ('the-soulfables-library',      'USD', 4500),
  ('heartbreak-anthology',        'USD', 1600),
  ('the-soul-journal',            'USD', 1800),
  ('the-reflection-deck',         'USD', 1500)
) as v(slug, currency, amount)
join products pr on pr.slug = v.slug
on conflict do nothing;

-- The $45 library contains everything else. This is what makes
-- grant_entitlements_for_order() fan out on purchase.
insert into product_bundle_items (bundle_id, child_id, sort_order)
select b.id, c.id, c.sort_order
from products b
cross join products c
where b.slug = 'the-soulfables-library'
  and c.slug <> 'the-soulfables-library'
on conflict do nothing;

-- Companions for the Heartbreak shelf.
insert into product_shelves (product_id, shelf_id, sort_order)
select p.id, s.id, 0
from products p, shelves s
where (p.slug, s.slug) in (
  ('the-version-of-me-you-broke', 'heartbreak'),
  ('heartbreak-anthology', 'heartbreak'),
  ('the-soul-journal', 'healing'),
  ('the-reflection-deck', 'healing')
)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Membership tiers. Free exists as a real row so that "what do I get"
-- is answerable from one table rather than from code.
-- ---------------------------------------------------------------------
insert into plans (slug, name, description, grants_premium_stories, grants_premium_audio, grants_ai_companion, sort_order) values
  ('free', 'Reader', 'The library, the journal, and the Weekly Letter.', false, false, false, 0),
  ('resident', 'Resident', 'Everything in the House, including narrated stories and the companion.', true, true, true, 1)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Crisis resources. Seeded with international fallbacks; the House should
-- replace these with regionally accurate entries before the AI companion
-- ships. Wrong numbers are worse than none.
-- ---------------------------------------------------------------------
insert into safety_resources (country_code, name, description, url, sort_order) values
  (null, 'Find a Helpline', 'Free, confidential support lines in over 130 countries.', 'https://findahelpline.com', 0),
  (null, 'International Association for Suicide Prevention', 'Directory of crisis centres worldwide.', 'https://www.iasp.info/resources/Crisis_Centres/', 1)
on conflict do nothing;
