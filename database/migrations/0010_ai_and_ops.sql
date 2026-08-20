-- =====================================================================
-- Soulfables — 0010 AI companion, analytics, audit, featured slots
-- =====================================================================

-- ---------------------------------------------------------------------
-- AI companion (brief §13)
--
-- Provider-agnostic on purpose: model and provider are stored per message,
-- so switching from one vendor to another is a config change and the
-- history stays readable. Nothing here assumes a particular API shape.
-- ---------------------------------------------------------------------
create table ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  -- What the reader opened the companion from, so the system prompt can
  -- be scoped to that context instead of the whole library.
  story_id   uuid references stories(id) on delete set null,
  shelf_id   uuid references shelves(id) on delete set null,
  entry_id   uuid references journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_conversations_updated_at before update on ai_conversations
  for each row execute function set_updated_at();

create table ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role            text not null,          -- user | assistant | system
  content         text not null,
  provider        text,
  model           text,
  input_tokens    integer,
  output_tokens   integer,
  -- Set when the safety classifier flags distress in a reader's message.
  -- The companion is a reflection tool, not a clinician: a flagged turn
  -- routes the reader to real resources and is retained so the House can
  -- review whether the response was appropriate.
  safety_flag     text,
  created_at      timestamptz not null default now()
);

create index ai_messages_conversation_idx on ai_messages (conversation_id, created_at);
create index ai_conversations_user_idx on ai_conversations (user_id, updated_at desc);
create index ai_messages_safety_idx on ai_messages (created_at desc) where safety_flag is not null;

-- Crisis resources, by region. A table so the House can keep them
-- accurate without a deploy — wrong helpline numbers are worse than none.
create table safety_resources (
  id           uuid primary key default gen_random_uuid(),
  country_code char(2),
  name         text not null,
  description  text,
  phone        text,
  url          text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0
);

-- ---------------------------------------------------------------------
-- Featured slots (brief §17) — homepage control without code changes.
-- A slot is a named placement with a time window; the site renders
-- whatever is live now, falling back to a sensible default when empty.
-- ---------------------------------------------------------------------
create table featured_slots (
  id          uuid primary key default gen_random_uuid(),
  placement   text not null,   -- home_hero | librarian_pick | shop_hero | shelf_spotlight
  entity_type text not null,   -- story | shelf | product | letter
  entity_id   uuid not null,
  headline    text,
  blurb       text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  sort_order  integer not null default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index featured_slots_live_idx
  on featured_slots (placement, sort_order, starts_at desc);

-- ---------------------------------------------------------------------
-- Analytics (brief §25)
--
-- First-party and deliberately thin: an event name, an optional entity,
-- and a small properties bag. No third-party identifiers, no ad pixels.
-- user_id is nullable so anonymous reading is measurable without
-- identifying anyone.
-- ---------------------------------------------------------------------
create table analytics_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  -- Rotating client-side id. Not a durable fingerprint.
  session_id  text,
  event_name  text not null,
  entity_type text,
  entity_id   uuid,
  properties  jsonb not null default '{}'::jsonb,
  surface     text,          -- web | ios | android
  created_at  timestamptz not null default now()
);

create index analytics_events_name_idx   on analytics_events (event_name, created_at desc);
create index analytics_events_entity_idx on analytics_events (entity_type, entity_id, created_at desc);
create index analytics_events_user_idx   on analytics_events (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Audit log (brief §21) — who changed what, in the admin dashboard.
-- Insert-only: no update or delete policy is ever granted on this table,
-- including to owners.
-- ---------------------------------------------------------------------
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,        -- product.publish | entitlement.grant | user.role_change
  entity_type text,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index audit_log_actor_idx  on audit_log (actor_id, created_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);
create index audit_log_action_idx on audit_log (action, created_at desc);

-- ---------------------------------------------------------------------
-- Transactional email log. Every send is recorded so "did the customer
-- get their book?" is answerable from the database, not the ESP dashboard.
-- ---------------------------------------------------------------------
create table email_events (
  id           bigserial primary key,
  to_email     text not null,
  user_id      uuid references auth.users(id) on delete set null,
  template     text not null,   -- welcome | receipt | delivery | password_reset
  order_id     uuid references orders(id) on delete set null,
  provider     text,
  provider_message_id text,
  status       text not null default 'queued',  -- queued | sent | delivered | bounced | failed
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index email_events_to_idx    on email_events (lower(to_email), created_at desc);
create index email_events_order_idx on email_events (order_id);
create index email_events_failed_idx on email_events (created_at desc)
  where status in ('bounced', 'failed');
