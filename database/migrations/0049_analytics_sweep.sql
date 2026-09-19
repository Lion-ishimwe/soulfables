-- =====================================================================
-- Soulfables — 0049 Sweep the analytics of a crawler
--
-- GPTBot followed Wander's "another" links round and round for four
-- days, two hundred times a minute, and every visit wrote a row: 1.3
-- million wander_chosen rows with no reader behind them, 528 MB, more
-- than the whole rest of the database. Real events are kept: every
-- event of a signed-in reader, and every event that is not a wander.
-- TRUNCATE rather than DELETE because it hands the space back at once.
-- =====================================================================

create temp table analytics_keep on commit drop as
  select * from analytics_events
  where event_name <> 'wander_chosen' or user_id is not null;

truncate analytics_events;

insert into analytics_events select * from analytics_keep;
