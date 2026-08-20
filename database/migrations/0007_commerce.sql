-- =====================================================================
-- Soulfables — 0007 Commerce
-- Products, prices, files, orders, and entitlements.
--
-- This file is the answer to brief §23. The rule it encodes:
--
--   Access to a file is NEVER derived from an order, a session, a
--   redirect, or anything the browser said. It is derived from a row in
--   `entitlements`, and only a verified provider webhook writes that row.
--
-- Everything else here exists to make that rule survivable: multi-format
-- files, bundles that fan out, refunds that revoke, and an idempotent
-- webhook log so a provider retry cannot double-grant or double-charge.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
create table products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  subtitle      text,
  description   text,
  -- The shop already sells five shapes of thing: an ebook, an anthology,
  -- a journal, a card deck, and a £45 everything-bundle. Modelling only
  -- "ebook" would be wrong on day one, not just later.
  kind          product_kind not null default 'ebook',
  author_id     uuid references authors(id) on delete set null,
  cover_image   text,
  -- Merchandising copy from the shop page ("THE EVERYDAY COMPANION").
  eyebrow       text,
  pull_quote    text,
  cta_label     text,
  status        publish_status not null default 'draft',
  is_featured   boolean not null default false,
  sort_order    integer not null default 0,
  seo_title     text,
  seo_description text,
  og_image      text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- Prices are rows, not a column: multi-currency from the start, and the
-- provider's own price identifier is stored beside ours so switching
-- providers is a re-sync, not a schema change.
create table product_prices (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id) on delete cascade,
  currency         char(3) not null,
  -- Minor units. 799 = $7.99. Never floats for money.
  unit_amount      integer not null,
  provider         text,
  provider_price_id text,
  is_default       boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint unit_amount_positive check (unit_amount >= 0)
);

create unique index product_prices_one_default
  on product_prices (product_id, currency) where is_default;
create index product_prices_lookup on product_prices (product_id, currency, is_active);

-- ---------------------------------------------------------------------
-- Files — the deliverable itself.
-- storage_path points into a PRIVATE Supabase Storage bucket. There is no
-- public URL for any row in this table, ever. Downloads are served only
-- as short-lived signed URLs minted after an entitlement check.
-- ---------------------------------------------------------------------
create table product_files (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  format          file_format not null,
  storage_path    text not null,
  original_name   text,
  file_size_bytes bigint,
  -- sha256, so we can prove the file a reader downloaded is the file we
  -- shipped, and detect a botched re-upload before customers do.
  checksum        text,
  version         integer not null default 1,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (product_id, format, version)
);

create index product_files_active_idx on product_files (product_id, is_active);

-- Bundles fan out to their children at grant time.
create table product_bundle_items (
  bundle_id  uuid not null references products(id) on delete cascade,
  child_id   uuid not null references products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (bundle_id, child_id),
  constraint no_self_bundle check (bundle_id <> child_id)
);

-- A product may also *be* a story in the library ("The Version Of Me You
-- Broke" is both a shelf entry and a $7.99 ebook). This join keeps the
-- two records linked without collapsing them into one table.
create table product_stories (
  product_id uuid not null references products(id) on delete cascade,
  story_id   uuid not null references stories(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, story_id)
);

-- Merchandising: "COMPANIONS FOR THIS SHELF".
create table product_shelves (
  product_id uuid not null references products(id) on delete cascade,
  shelf_id   uuid not null references shelves(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, shelf_id)
);

-- ---------------------------------------------------------------------
-- Orders
-- Provider-agnostic by construction. `provider` is text, not an enum,
-- because the Rwanda entity question (Paddle / Flutterwave / Stripe via a
-- foreign entity) is not settled and this schema must not presuppose it.
-- ---------------------------------------------------------------------
create table orders (
  id                   uuid primary key default gen_random_uuid(),
  -- Human-facing reference on receipts: SF-2026-0001
  reference            text not null unique,
  -- Nullable: guest checkout is allowed, and the order is claimed when
  -- the buyer later signs up with the same email.
  user_id              uuid references auth.users(id) on delete set null,
  email                text not null,
  status               order_status not null default 'pending',
  provider             text not null,
  provider_session_id  text,
  provider_payment_id  text,
  currency             char(3) not null,
  subtotal_amount      integer not null default 0,
  discount_amount      integer not null default 0,
  tax_amount           integer not null default 0,
  total_amount         integer not null default 0,
  -- Set only by the webhook handler, never by a client callback.
  paid_at              timestamptz,
  refunded_at          timestamptz,
  failure_reason       text,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

create unique index orders_provider_session_idx
  on orders (provider, provider_session_id) where provider_session_id is not null;
create index orders_user_idx  on orders (user_id, created_at desc);
create index orders_email_idx on orders (lower(email), created_at desc);
create index orders_status_idx on orders (status, created_at desc);

create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  uuid not null references products(id) on delete restrict,
  -- Title and amount are snapshotted: a later price change or retitle must
  -- not rewrite history on an issued receipt.
  title_snapshot text not null,
  unit_amount    integer not null,
  currency       char(3) not null,
  quantity       integer not null default 1,
  constraint quantity_positive check (quantity > 0)
);

create index order_items_order_idx on order_items (order_id);

-- ---------------------------------------------------------------------
-- Entitlements — the single source of truth for "may this person open
-- this file". Nothing else grants access.
-- ---------------------------------------------------------------------
create table entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  source      entitlement_source not null,
  order_id    uuid references orders(id) on delete set null,
  subscription_id uuid,     -- FK added in 0008
  granted_at  timestamptz not null default now(),
  -- Non-null once revoked (refund, chargeback, subscription lapse).
  revoked_at  timestamptz,
  revoked_reason text,
  -- Null means perpetual. Subscription-derived entitlements set this.
  expires_at  timestamptz,
  granted_by  uuid references auth.users(id),
  notes       text
);

-- A reader holds at most one live entitlement per product per source.
-- Partial unique index, so a revoked grant does not block a re-purchase.
create unique index entitlements_live_idx
  on entitlements (user_id, product_id, source)
  where revoked_at is null;

create index entitlements_user_idx  on entitlements (user_id) where revoked_at is null;
create index entitlements_order_idx on entitlements (order_id);

-- Authoritative check, used by RLS and by the download endpoint.
create or replace function has_entitlement(p_user uuid, p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1 from entitlements e
    where e.user_id = p_user
      and e.product_id = p_product
      and e.revoked_at is null
      and (e.expires_at is null or e.expires_at > now())
  );
$func$;

-- ---------------------------------------------------------------------
-- Download audit — every signed URL we mint, and every file that URL was
-- minted for. Feeds abuse detection and answers "did they actually get
-- it?" when a customer writes in.
-- ---------------------------------------------------------------------
create table download_events (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete set null,
  entitlement_id  uuid references entitlements(id) on delete set null,
  product_file_id uuid references product_files(id) on delete set null,
  -- Signed URL lifetime we issued, for support forensics.
  expires_at      timestamptz,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index download_events_user_idx on download_events (user_id, created_at desc);
create index download_events_rate_idx on download_events (user_id, created_at);

-- ---------------------------------------------------------------------
-- Webhook log — idempotency and replay safety.
-- The handler INSERTs here first. A duplicate provider_event_id violates
-- the unique index, the handler catches it and returns 200 without
-- re-granting. This is what makes a provider retry storm harmless.
-- ---------------------------------------------------------------------
create table webhook_events (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null,
  provider_event_id  text not null,
  event_type         text not null,
  payload            jsonb not null,
  signature_verified boolean not null default false,
  processed_at       timestamptz,
  error              text,
  attempts           integer not null default 0,
  received_at        timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index webhook_events_unprocessed_idx
  on webhook_events (received_at) where processed_at is null;

-- ---------------------------------------------------------------------
-- Grant fan-out.
-- Called by the webhook handler inside the same transaction that marks an
-- order paid. Expands bundles one level, is idempotent via ON CONFLICT,
-- and returns the number of NEW entitlements so the caller knows whether
-- to send the delivery email.
-- ---------------------------------------------------------------------
create or replace function grant_entitlements_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_user_id uuid;
  v_granted integer := 0;
begin
  select user_id into v_user_id from orders where id = p_order_id;

  if v_user_id is null then
    -- Guest checkout. The order stays unclaimed until the buyer creates
    -- an account with the same email; claim_orders_for_user() then runs.
    return 0;
  end if;

  with purchased as (
    -- Directly purchased products...
    select oi.product_id
    from order_items oi
    where oi.order_id = p_order_id
    union
    -- ...plus everything inside any purchased bundle.
    select bi.child_id
    from order_items oi
    join product_bundle_items bi on bi.bundle_id = oi.product_id
    where oi.order_id = p_order_id
  ),
  inserted as (
    insert into entitlements (user_id, product_id, source, order_id)
    select v_user_id, p.product_id, 'purchase', p_order_id
    from purchased p
    on conflict do nothing
    returning 1
  )
  select count(*) into v_granted from inserted;

  return v_granted;
end;
$func$;

-- Revoke on refund. Only touches grants that came from this order.
create or replace function revoke_entitlements_for_order(p_order_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_count integer;
begin
  update entitlements
     set revoked_at = now(), revoked_reason = p_reason
   where order_id = p_order_id
     and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$func$;

-- Guest-checkout reconciliation: run on signup and on email confirmation.
create or replace function claim_orders_for_user(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_order record;
  v_total integer := 0;
begin
  for v_order in
    select id from orders
     where user_id is null
       and lower(email) = lower(p_email)
       and status = 'paid'
  loop
    update orders set user_id = p_user_id where id = v_order.id;
    v_total := v_total + grant_entitlements_for_order(v_order.id);
  end loop;

  return v_total;
end;
$func$;
