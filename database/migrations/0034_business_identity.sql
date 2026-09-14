-- =====================================================================
-- Soulfables — 0034 Who the House is, on paper
--
-- A receipt has to say who took the money, and a privacy page has to
-- name the controller. Neither can be typed into the page that shows
-- it: the entity is being registered in Europe, and its name, address
-- and tax number are decisions the House makes once and changes never.
-- Three columns on the one settings row, edited in Settings → The House.
-- =====================================================================

alter table house_settings
  add column if not exists legal_name    text,
  add column if not exists legal_address text,
  add column if not exists vat_number    text;

comment on column house_settings.legal_name is
  'The registered business behind the House, as it appears on receipts and the privacy page. Null until registered.';
comment on column house_settings.legal_address is
  'The registered address, one line per line. Shown on receipts.';
comment on column house_settings.vat_number is
  'The VAT or tax registration number, if any. Shown on receipts when set.';
