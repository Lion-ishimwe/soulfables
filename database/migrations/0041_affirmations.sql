-- =====================================================================
-- Soulfables — 0041 Affirmations
--
-- One calm line a day, for everyone. Shown in the Reading Room, and one
-- of the four things the Librarian may offer. Kept in their own table
-- rather than as a kind of prompt because a prompt asks and an
-- affirmation tells, and the admin page should not mix the two.
-- =====================================================================

create table if not exists affirmations (
  id          uuid primary key default gen_random_uuid(),
  body        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table affirmations is
  'Calm lines the House says once a day. Settings → Questions manages them; the day picks one.';

alter table affirmations enable row level security;

create policy affirmations_public_read on affirmations
  for select using (is_active or is_staff());
create policy affirmations_staff_write on affirmations
  for all using (is_staff()) with check (is_staff());

insert into affirmations (body, sort_order)
select v.body, v.sort_order
from (values
  ('You are allowed to take up the room you are in.',                              1),
  ('Nothing you feel tonight has to be fixed by morning.',                          2),
  ('Slowness is not the same as falling behind.',                                   3),
  ('You have survived every night so far.',                                         4),
  ('What you carry is heavy because it mattered.',                                  5),
  ('You can be unfinished and still be whole.',                                     6),
  ('The quiet is not empty. It is where you can hear yourself.',                    7),
  ('It is enough to have stayed.',                                                  8),
  ('You do not owe anyone the version of you they expected.',                       9),
  ('Rest is a way of continuing.',                                                 10),
  ('Some doors close so you can hear the ones that are open.',                     11),
  ('You are more than the worst thing that happened to you.',                      12),
  ('Healing counts even when nobody sees it.',                                     13),
  ('Tomorrow will meet you where you are, not where you should be.',               14)
) as v(body, sort_order)
where not exists (select 1 from affirmations a where a.body = v.body);
