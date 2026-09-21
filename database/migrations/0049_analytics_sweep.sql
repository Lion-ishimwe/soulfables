-- =====================================================================
-- Soulfables — 0049 Sweep the analytics of a crawler
--
-- GPTBot followed Wander's "another" links round and round for four
-- days, two hundred times a minute, and every visit wrote a row: 1.3
-- million wander_chosen rows with no reader behind them, 528 MB, more
-- than the whole rest of the database. Anonymous wander rows go; every
-- event of a signed-in reader, and every other kind of event, stays.
--
-- A plain DELETE, on purpose: the migration runner applies each
-- statement on its own connection turn, so a temporary table "on commit
-- drop" vanished between statements and the first version of this file
-- failed halfway (after its TRUNCATE had already run). DELETE is safe
-- to repeat.
-- =====================================================================

delete from analytics_events
where event_name = 'wander_chosen' and user_id is null;
