-- =====================================================================
-- Soulfables — 0026 Shelves and themes are different kinds of thing
--
-- A shelf is an emotional doorway: the feeling a reader arrives carrying,
-- which is why the Library is browsed by them. A theme is metadata about
-- a story: what it is actually about.
--
-- The seeded vocabularies did not respect that. Six of the twelve themes
-- were the same word as a shelf — Heartbreak, Healing, Grief, Hope,
-- Forgiveness, Love — so a story on the Grief shelf could be tagged
-- "Grief" and say nothing, and two of them were. The rest mostly listed
-- more feelings where a subject belonged.
--
--   Before   shelf: Heartbreak   themes: Grief, Nostalgia
--   After    shelf: Heartbreak   themes: Home, Memory
--
-- So the doorway words come out of the theme list, subjects go in, every
-- story is re-tagged, and a trigger keeps the two vocabularies from ever
-- sharing a word again. Enforced at the database because both tables are
-- editable from the admin, and this is the kind of rule that decays
-- quietly — one plausible-looking theme at a time.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Out: every theme that is really a doorway.
--
-- story_themes cascades, so the wrong tags go with them. That is the
-- intent: a tag that repeated its own shelf carried no information worth
-- migrating.
-- ---------------------------------------------------------------------
delete from themes
where slug in ('heartbreak', 'healing', 'grief', 'hope', 'forgiveness', 'love');

-- ---------------------------------------------------------------------
-- In: subjects and situations. What a story is about, never how it feels
-- to arrive at one.
-- ---------------------------------------------------------------------
insert into themes (slug, label, description, sort_order) values
  ('identity',    'Identity',    'Who someone is, or is no longer.',                      0),
  ('self-worth',  'Self-worth',  'What a person believes they deserve.',                  1),
  ('becoming',    'Becoming',    'Changing into someone the story earns.',                2),
  ('belonging',   'Belonging',   'Having, or lacking, a place among people.',             3),
  ('family',      'Family',      'The people you did not choose.',                        4),
  ('motherhood',  'Motherhood',  'Mothers, and being mothered.',                          5),
  ('friendship',  'Friendship',  'The people you did choose.',                            6),
  ('marriage',    'Marriage',    'A life shared, or the end of one.',                     7),
  ('devotion',    'Devotion',    'Loving somebody — the subject, not the feeling.',       8),
  ('betrayal',    'Betrayal',    'Trust given and broken.',                               9),
  ('secrets',     'Secrets',     'What is kept, and what keeping it costs.',             10),
  ('silence',     'Silence',     'What goes unsaid.',                                    11),
  ('memory',      'Memory',      'The past, still working on the present.',              12),
  ('nostalgia',   'Nostalgia',   'Longing for a time rather than a person.',             13),
  ('home',        'Home',        'A place that holds, or stops holding.',                14),
  ('leaving',     'Leaving',     'Going, and what going costs.',                         15),
  ('return',      'Return',      'Coming back, and finding it changed.',                 16),
  ('regret',      'Regret',      'The road not taken, looked at again.',                 17),
  ('letting-go',  'Letting go',  'Putting something down on purpose.',                   18),
  ('purpose',     'Purpose',     'What a life is for.',                                  19),
  ('faith',       'Faith',       'Belief, held or lost.',                                20)
on conflict (slug) do update
  set label       = excluded.label,
      description = excluded.description,
      sort_order  = excluded.sort_order,
      is_active   = true;

-- ---------------------------------------------------------------------
-- Re-tag. Two subjects each, none repeating the story's own shelf.
--
-- Written as a join, so it is a no-op where the stories do not exist —
-- the schema test runs against an empty database.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Keep them apart.
--
-- A check constraint cannot see another table, so this is a trigger on
-- both. It compares slug and label, case-insensitively, in both
-- directions — adding a shelf called "Memory" is the same mistake as
-- adding a theme called "Grief", and whoever makes it is equally unlikely
-- to notice.
-- ---------------------------------------------------------------------
create or replace function public.enforce_taxonomy_separation()
returns trigger
language plpgsql
as $$
declare
  v_other text;
begin
  if tg_table_name = 'themes' then
    select s.label into v_other
      from shelves s
     where lower(s.slug) = lower(new.slug)
        or lower(s.label) = lower(new.label)
     limit 1;

    if v_other is not null then
      raise exception
        'Theme "%" collides with the shelf "%". A shelf is the feeling a reader arrives with; a theme is what a story is about. They must not share a word.',
        new.label, v_other;
    end if;
  else
    select t.label into v_other
      from themes t
     where lower(t.slug) = lower(new.slug)
        or lower(t.label) = lower(new.label)
     limit 1;

    if v_other is not null then
      raise exception
        'Shelf "%" collides with the theme "%". A shelf is the feeling a reader arrives with; a theme is what a story is about. They must not share a word.',
        new.label, v_other;
    end if;
  end if;

  return new;
end
$$;

comment on function public.enforce_taxonomy_separation() is
  'Stops a shelf and a theme sharing a word. Shelves are doorways, themes are subjects; the distinction decays quietly without this.';

drop trigger if exists themes_taxonomy_separation on themes;
create trigger themes_taxonomy_separation
  before insert or update of slug, label on themes
  for each row execute function public.enforce_taxonomy_separation();

drop trigger if exists shelves_taxonomy_separation on shelves;
create trigger shelves_taxonomy_separation
  before insert or update of slug, label on shelves
  for each row execute function public.enforce_taxonomy_separation();
