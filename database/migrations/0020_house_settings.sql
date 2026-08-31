-- =====================================================================
-- Soulfables — 0020 House settings
--
-- The things the House says about itself — its name, its tagline, the
-- addresses a reader writes to — were typed into the pages that display
-- them. Two files each carried a support address, and both carried
-- soulfables.com while the site is soulfables.co, which is exactly the
-- failure mode of a value kept in more than one place.
--
-- One row, edited in the admin, read everywhere.
-- =====================================================================

create table if not exists house_settings (
  -- A singleton. The check constraint is what makes it one: there is one
  -- House, and a settings table that can hold two rows eventually does.
  id                    integer primary key default 1 check (id = 1),

  site_name             text not null default 'Soulfables',
  tagline               text not null default 'Every Soul Has a Story',

  -- Both addresses are shown on the support page. Splitting them is
  -- deliberate: a question about an order and a question about a story
  -- are read by different people.
  support_email_general text not null default 'hello@soulfables.co',
  support_email_shop    text not null default 'support@soulfables.co',

  -- Used for canonical URLs and anything emailed. Kept here as well as in
  -- the environment so the House can be told its own address without a
  -- redeploy.
  site_url              text,

  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id) on delete set null
);

insert into house_settings (id) values (1) on conflict (id) do nothing;

alter table house_settings enable row level security;

-- ---------------------------------------------------------------------
-- Readable by anyone: the support page shows these addresses to visitors
-- who are not signed in, and a tagline is not a secret.
--
-- Writable by staff only, which is the whole point of the page.
-- ---------------------------------------------------------------------
create policy house_settings_public_read on house_settings
  for select using (true);

create policy house_settings_staff_write on house_settings
  for all using (is_staff()) with check (is_staff());

create trigger house_settings_updated_at
  before update on house_settings
  for each row execute function set_updated_at();

comment on table house_settings is
  'One row. What the House says about itself, so it is not typed into the pages that display it.';
