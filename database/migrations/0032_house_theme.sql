-- =====================================================================
-- Soulfables — 0032 The House's theme
--
-- The site is night-first, and until now that was a fact of the CSS.
-- Now it is a setting: dark by default, and the House can switch to a
-- daylight palette for everyone, from Settings → The House. One value
-- for the whole site, because a House with two faces at once is not a
-- house.
-- =====================================================================

alter table house_settings
  add column if not exists theme text not null default 'dark'
    check (theme in ('dark', 'light'));

comment on column house_settings.theme is
  'The palette the whole site wears: dark (the default) or light. Set from Settings → The House.';
