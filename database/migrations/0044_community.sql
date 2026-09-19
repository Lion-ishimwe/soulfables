-- =====================================================================
-- Soulfables — 0044 The community
--
-- People connect through stories. What that means here, and what the
-- database enforces rather than merely hopes:
--
--   A post is a reader's own story or reflection, under their name, a
--   pen name, or no name. It is pending until a person at the House has
--   read it; only published posts are visible to anyone but the writer
--   and staff. The name shown is written onto the post when it is made,
--   so nobody's profile has to be readable to show the wall.
--
--   Reactions are three fixed words — seen, held, thank you — one of
--   each per reader per post. No open emoji picker, no counts to chase.
--
--   Replies are supportive words under a post. Pending until reviewed,
--   unless the House has marked the reader trusted; then they publish
--   at once.
--
--   Challenges are a prompt with dates; responses are posts that name
--   the challenge.
--
--   Reports let any reader flag a post or reply; staff see them in one
--   queue. Blocked words live in house_settings and are checked before
--   anything is written.
-- =====================================================================

alter table profiles
  add column if not exists trusted boolean not null default false;
comment on column profiles.trusted is 'Replies from a trusted reader publish without review. Set by staff from the community queue.';

alter table house_settings
  add column if not exists community_blocked_words text not null default '';
comment on column house_settings.community_blocked_words is 'Comma-separated words that stop a community post or reply before it is written.';

create table if not exists community_challenges (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  prompt      text not null,
  starts_on   date not null default current_date,
  ends_on     date not null default current_date + 14,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists community_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  author_name   text not null,
  anonymous     boolean not null default false,
  kind          text not null default 'reflection' check (kind in ('story', 'reflection', 'response')),
  title         text,
  body          text not null,
  challenge_id  uuid references community_challenges(id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'removed')),
  review_note   text,
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists community_posts_wall_idx on community_posts (status, published_at desc);
create index if not exists community_posts_user_idx on community_posts (user_id, created_at desc);

create table if not exists community_replies (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references community_posts(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  author_name   text not null,
  body          text not null,
  status        text not null default 'pending' check (status in ('pending', 'published', 'removed')),
  reviewed_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists community_replies_post_idx on community_replies (post_id, status, created_at);

create table if not exists community_reactions (
  post_id     uuid not null references community_posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('seen', 'held', 'thank_you')),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table if not exists community_reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('post', 'reply')),
  target_id    uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  reason       text not null,
  note         text,
  status       text not null default 'open' check (status in ('open', 'closed')),
  closed_by    uuid references auth.users(id) on delete set null,
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists community_reports_open_idx on community_reports (status, created_at desc);

alter table community_challenges enable row level security;
alter table community_posts      enable row level security;
alter table community_replies    enable row level security;
alter table community_reactions  enable row level security;
alter table community_reports    enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'community_posts' and policyname = 'community_posts_read') then
    create policy community_challenges_read on community_challenges for select using (is_active or is_staff());
    create policy community_challenges_staff on community_challenges for all using (is_staff()) with check (is_staff());

    create policy community_posts_read on community_posts for select
      using (status = 'published' or user_id = auth.uid() or is_staff());
    create policy community_posts_insert on community_posts for insert
      with check (user_id = auth.uid() and status = 'pending');
    create policy community_posts_staff_update on community_posts for update
      using (is_staff()) with check (is_staff());
    create policy community_posts_delete on community_posts for delete
      using ((user_id = auth.uid() and status = 'pending') or is_staff());

    create policy community_replies_read on community_replies for select
      using (status = 'published' or user_id = auth.uid() or is_staff());
    create policy community_replies_insert on community_replies for insert
      with check (user_id = auth.uid() and status = 'pending');
    create policy community_replies_staff_update on community_replies for update
      using (is_staff()) with check (is_staff());
    create policy community_replies_delete on community_replies for delete
      using ((user_id = auth.uid() and status = 'pending') or is_staff());

    create policy community_reactions_read on community_reactions for select using (true);
    create policy community_reactions_own on community_reactions for insert
      with check (user_id = auth.uid());
    create policy community_reactions_own_delete on community_reactions for delete
      using (user_id = auth.uid());

    create policy community_reports_insert on community_reports for insert
      with check (user_id = auth.uid());
    create policy community_reports_staff on community_reports for select using (is_staff());
    create policy community_reports_staff_update on community_reports for update
      using (is_staff()) with check (is_staff());
  end if;
end $$;

-- The first challenge, so the wall has a door on it from day one.
insert into community_challenges (slug, title, prompt, starts_on, ends_on)
select 'the-thing-you-kept', 'The Thing You Kept',
       'Write about one object you kept after a season ended — what it is, where it lives now, and what it holds.',
       current_date, current_date + 21
where not exists (select 1 from community_challenges where slug = 'the-thing-you-kept');
