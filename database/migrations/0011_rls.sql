-- =====================================================================
-- Soulfables — 0011 Row Level Security
--
-- Posture: deny by default. RLS is enabled on every table. A table with
-- no policy is reachable only by the service role, which lives exclusively
-- in server-side code and is never shipped to a browser or a phone.
--
-- Three audiences:
--   anon          — the public web. Reads published content. Nothing else.
--   authenticated — a reader. Reads published content plus their own rows.
--   staff/admin   — via auth_role(); editorial and operational access,
--                   with two deliberate exceptions noted below.
--
-- The two things staff explicitly CANNOT do:
--   1. Read journal entries. Private means private, including from us.
--   2. Write entitlements from the client. Only the service role grants
--      access, and only after a verified webhook.
-- =====================================================================

-- Enable RLS everywhere. Any table added later must be added here too;
-- the CI check in scripts/check-rls.sql fails the build if one is missed.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_staff());

create policy profiles_self_write on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy user_settings_self on user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A reader may see their own role; only an owner may change any role.
create policy user_roles_self_read on user_roles
  for select using (user_id = auth.uid() or is_admin());

create policy user_roles_owner_write on user_roles
  for all using (auth_role() = 'owner') with check (auth_role() = 'owner');

-- ---------------------------------------------------------------------
-- Published content — readable by the world, writable by staff.
-- ---------------------------------------------------------------------
create policy authors_public_read on authors for select using (true);
create policy authors_staff_write on authors for all
  using (is_staff()) with check (is_staff());

create policy themes_public_read on themes for select using (is_active or is_staff());
create policy themes_staff_write on themes for all
  using (is_staff()) with check (is_staff());

create policy tags_public_read on tags for select using (true);
create policy tags_staff_write on tags for all
  using (is_staff()) with check (is_staff());

create policy shelves_public_read on shelves
  for select using (status = 'published' or is_staff());
create policy shelves_staff_write on shelves for all
  using (is_staff()) with check (is_staff());

create policy shelf_journeys_public_read on shelf_journeys for select using (true);
create policy shelf_journeys_staff_write on shelf_journeys for all
  using (is_staff()) with check (is_staff());

create policy series_public_read on series
  for select using (status = 'published' or is_staff());
create policy series_staff_write on series for all
  using (is_staff()) with check (is_staff());

-- Stories: published rows are public. Note that `access = 'premium'` does
-- NOT hide the row — the listing, cover and blurb of a premium story are
-- public for SEO. The paywall is enforced on body_mdx by the API layer,
-- which omits it unless has_premium_access() or has_entitlement() passes.
create policy stories_public_read on stories
  for select using (status = 'published' or is_staff());
create policy stories_staff_write on stories for all
  using (is_staff()) with check (is_staff());

create policy story_sections_public_read on story_sections for select using (
  exists (select 1 from stories s where s.id = story_id
          and (s.status = 'published' or is_staff()))
);
create policy story_sections_staff_write on story_sections for all
  using (is_staff()) with check (is_staff());

create policy story_shelves_public_read on story_shelves for select using (true);
create policy story_shelves_staff_write on story_shelves for all
  using (is_staff()) with check (is_staff());

create policy story_themes_public_read on story_themes for select using (true);
create policy story_themes_staff_write on story_themes for all
  using (is_staff()) with check (is_staff());

create policy story_tags_public_read on story_tags for select using (true);
create policy story_tags_staff_write on story_tags for all
  using (is_staff()) with check (is_staff());

create policy story_relations_public_read on story_relations for select using (true);
create policy story_relations_staff_write on story_relations for all
  using (is_staff()) with check (is_staff());

-- Audio metadata is public (so a player can show duration); the file
-- itself lives in a private bucket and is fetched only via a signed URL.
create policy story_audio_public_read on story_audio for select using (
  exists (select 1 from stories s where s.id = story_id
          and (s.status = 'published' or is_staff()))
);
create policy story_audio_staff_write on story_audio for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------
-- Reader-private tables. One uniform rule.
-- ---------------------------------------------------------------------
create policy reading_progress_self on reading_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy saved_stories_self on saved_stories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy bookmarks_self on bookmarks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy saved_passages_self on saved_passages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reading_history_self on reading_history
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Journal — the strictest tables in the system.
-- No is_staff() escape hatch anywhere in this block. An admin needing to
-- action a deletion request does so through a logged service-role script,
-- not by reading entries in a dashboard.
-- ---------------------------------------------------------------------
create policy journal_entries_self on journal_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy journal_entry_tags_self on journal_entry_tags
  for all using (
    exists (select 1 from journal_entries e
            where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from journal_entries e
            where e.id = entry_id and e.user_id = auth.uid())
  );

create policy moods_public_read on moods for select using (is_active or is_staff());
create policy moods_staff_write on moods for all
  using (is_staff()) with check (is_staff());

create policy journal_prompts_public_read on journal_prompts
  for select using (is_active or is_staff());
create policy journal_prompts_staff_write on journal_prompts for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------
-- Commerce
-- ---------------------------------------------------------------------
create policy products_public_read on products
  for select using (status = 'published' or is_staff());
create policy products_staff_write on products for all
  using (is_staff()) with check (is_staff());

create policy product_prices_public_read on product_prices
  for select using (is_active or is_staff());
create policy product_prices_staff_write on product_prices for all
  using (is_staff()) with check (is_staff());

create policy product_bundle_public_read on product_bundle_items for select using (true);
create policy product_bundle_staff_write on product_bundle_items for all
  using (is_staff()) with check (is_staff());

create policy product_stories_public_read on product_stories for select using (true);
create policy product_stories_staff_write on product_stories for all
  using (is_staff()) with check (is_staff());

create policy product_shelves_public_read on product_shelves for select using (true);
create policy product_shelves_staff_write on product_shelves for all
  using (is_staff()) with check (is_staff());

-- product_files: the crux of brief §21.
-- A reader may see a file row ONLY if they hold a live entitlement to its
-- product. Even then the row contains a storage_path, not a URL — the path
-- is useless without a signed token minted server-side.
create policy product_files_entitled_read on product_files
  for select using (
    is_staff() or (auth.uid() is not null and has_entitlement(auth.uid(), product_id))
  );
create policy product_files_staff_write on product_files for all
  using (is_staff()) with check (is_staff());

-- Orders are readable by the buyer and by staff. They are NEVER written
-- from the client: checkout creates them through the service role, and
-- only the webhook handler moves an order to 'paid'.
create policy orders_self_read on orders
  for select using (user_id = auth.uid() or is_staff());

create policy order_items_self_read on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.user_id = auth.uid() or is_staff()))
  );

-- Entitlements: read-only to the reader who holds them. There is no
-- insert, update or delete policy for any client role — deliberately.
-- Grants happen exclusively through the service role.
create policy entitlements_self_read on entitlements
  for select using (user_id = auth.uid() or is_staff());

create policy download_events_self_read on download_events
  for select using (user_id = auth.uid() or is_staff());

-- webhook_events, email_events: no policies at all. Service role only.

-- ---------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------
create policy plans_public_read on plans for select using (is_active or is_staff());
create policy plans_staff_write on plans for all
  using (is_admin()) with check (is_admin());

create policy plan_prices_public_read on plan_prices for select using (is_active or is_staff());
create policy plan_prices_admin_write on plan_prices for all
  using (is_admin()) with check (is_admin());

create policy plan_products_public_read on plan_products for select using (true);
create policy plan_products_admin_write on plan_products for all
  using (is_admin()) with check (is_admin());

create policy subscriptions_self_read on subscriptions
  for select using (user_id = auth.uid() or is_staff());
-- No client write path: cancellation goes through the provider, and the
-- webhook writes the result back.

-- ---------------------------------------------------------------------
-- Letters and community
-- ---------------------------------------------------------------------
create policy letters_public_read on letters
  for select using (status = 'published' or is_staff());
create policy letters_staff_write on letters for all
  using (is_staff()) with check (is_staff());

-- Subscribers: staff-only reads. Signup and unsubscribe go through
-- service-role endpoints so an email address can never be enumerated.
create policy letter_subscribers_staff on letter_subscribers for all
  using (is_staff()) with check (is_staff());

create policy letter_sends_staff on letter_sends for select using (is_staff());

-- Published voices are public; a reader can see and withdraw their own.
create policy reader_voices_public_read on reader_voices
  for select using (status = 'published' or user_id = auth.uid() or is_staff());
create policy reader_voices_self_insert on reader_voices
  for insert with check (user_id = auth.uid());
create policy reader_voices_self_delete on reader_voices
  for delete using (user_id = auth.uid() or is_staff());
create policy reader_voices_staff_moderate on reader_voices
  for update using (is_staff()) with check (is_staff());

create policy resident_profiles_read on resident_profiles
  for select using (is_public or user_id = auth.uid() or is_staff());
create policy resident_profiles_self on resident_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- AI
-- ---------------------------------------------------------------------
create policy ai_conversations_self on ai_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ai_messages_self on ai_messages
  for all using (
    exists (select 1 from ai_conversations c
            where c.id = conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from ai_conversations c
            where c.id = conversation_id and c.user_id = auth.uid())
  );

create policy safety_resources_public_read on safety_resources
  for select using (is_active);
create policy safety_resources_staff_write on safety_resources for all
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------------------
-- Ops
-- ---------------------------------------------------------------------
create policy featured_slots_public_read on featured_slots for select using (true);
create policy featured_slots_staff_write on featured_slots for all
  using (is_staff()) with check (is_staff());

-- Anyone, signed in or not, may record an event about themselves.
-- Nobody but staff may read them back.
create policy analytics_insert_any on analytics_events
  for insert with check (user_id is null or user_id = auth.uid());
create policy analytics_staff_read on analytics_events
  for select using (is_staff());

-- Audit log is append-only and admin-readable. No update or delete policy
-- exists for any role, including owner.
create policy audit_log_admin_read on audit_log for select using (is_admin());
create policy audit_log_staff_insert on audit_log for insert with check (is_staff());
