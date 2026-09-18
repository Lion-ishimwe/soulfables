-- =====================================================================
-- Soulfables — 0040 The drawer of quiet questions
--
-- A card is a journal prompt with a face: a name, the feeling it
-- belongs to, a whisper, and the question itself. The prompts table
-- always allowed kind = 'deck'; now the columns a card needs exist, and
-- the twelve cards from the first House are in the drawer.
--
-- Staff add and change cards from Settings → Questions. Because a card
-- is a prompt, a reflection written to one lands in the journal against
-- it, and "entries written" counts as it does for the question of the
-- day. Nothing here touches the daily pool: kind keeps them apart.
-- =====================================================================

alter table journal_prompts
  add column if not exists title      text,
  add column if not exists feeling    text,
  add column if not exists whisper    text,
  add column if not exists glyph      text,
  add column if not exists sort_order integer not null default 0;

comment on column journal_prompts.title      is 'The card''s name, e.g. "The Empty Room". Deck cards only.';
comment on column journal_prompts.feeling    is 'The feeling the card belongs to, e.g. "Grief". Deck cards only.';
comment on column journal_prompts.whisper    is 'One line said before the question. Deck cards only.';
comment on column journal_prompts.glyph      is 'An optional mark for the card face. Empty means the House''s star.';
comment on column journal_prompts.sort_order is 'Order in the admin list. The drawer itself shuffles.';

create index if not exists journal_prompts_deck_idx
  on journal_prompts (sort_order, created_at) where kind = 'deck';

insert into journal_prompts (kind, title, feeling, whisper, body, sort_order)
select v.kind, v.title, v.feeling, v.whisper, v.body, v.sort_order
from (values
  ('deck', 'The Sentence',       'Memory',     'A single sentence can reach you across years.',                        'What line from a story still follows you today?',                                             1),
  ('deck', 'One Deep Breath',    'Presence',   'One breath can hold an entire night.',                                 'What made a whole night disappear into one breath?',                                          2),
  ('deck', 'The Forgotten Self', 'Identity',   'We put away what we can''t name, and it waits.',                       'What is the part of your soul you''ve learned to put away?',                                  3),
  ('deck', 'The Unspoken',       'Self',       'Some names are given. Others are discovered.',                         'Which part of yourself have you kept hidden because the world wasn''t ready to meet it?',    4),
  ('deck', 'The Stranger',       'Compassion', 'Every stranger carries a story you''ll never fully know.',             'When have you been kind to someone without knowing what they were carrying?',                5),
  ('deck', 'The Mend',           'Healing',    'Healing rarely arrives all at once.',                                  'What is the smallest thing that mends a hole in a heart?',                                    6),
  ('deck', 'The Way Home',       'Hope',       'Someone always carries you home, even when you forget the way.',       'When was the last time someone carried you home?',                                            7),
  ('deck', 'The Carrying',       'Heart',      'Some people carry us long after they''ve gone.',                       'What did you hold someone through a season?',                                                 8),
  ('deck', 'The Shelf',          'Library',    'Stories often find us before we know what we''re looking for.',        'Which shelf keeps calling your name?',                                                        9),
  ('deck', 'The Silence',        'Connection', 'Silence between two people is never empty — it carries everything.',   'When was the silence between two people its own language?',                                  10),
  ('deck', 'The Empty Room',     'Grief',      'Some rooms never stop remembering.',                                   'What lived in the room with you, long after they were gone?',                                11),
  ('deck', 'The Turning Tide',   'Becoming',   'Every tide carries what we bury beneath it.',                          'What small moment became the beginning of a different life?',                                12)
) as v(kind, title, feeling, whisper, body, sort_order)
where not exists (
  select 1 from journal_prompts p where p.kind = 'deck' and p.body = v.body
);
