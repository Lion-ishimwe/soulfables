-- =====================================================================
-- Soulfables — 0038 Every published story is read aloud
--
-- Narration is no longer something somebody remembers to do: when a
-- story is published, or a published story's words change, the House
-- has a generated voice read it. A recording made by a person is never
-- replaced by a generated one.
--
-- source_hash remembers which words a narration was read from, so a
-- save that changed nothing does not cost a reading, and a save that
-- changed the prose gets a fresh one. auto_narration is the House's
-- switch for the whole behaviour, on by default.
-- =====================================================================

alter table story_audio
  add column if not exists source_hash text;

comment on column story_audio.source_hash is
  'A hash of the text this narration was generated from. Null for a recording. Used to skip re-reading unchanged words.';

alter table house_settings
  add column if not exists auto_narration boolean not null default true;

comment on column house_settings.auto_narration is
  'Read every published story aloud with a generated voice, at publication and whenever its words change. Settings → The House.';
