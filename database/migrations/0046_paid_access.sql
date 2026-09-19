-- =====================================================================
-- Soulfables — 0046 A third kind of access: for sale
--
-- A story can be free, kept for Premium, or sold as a book. The enum
-- gains the third value here, on its own, because Postgres will not let
-- a migration use a value it added in the same transaction. 0047 does
-- the using.
-- =====================================================================

alter type access_level add value if not exists 'paid';
