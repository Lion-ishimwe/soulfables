-- =====================================================================
-- Soulfables — 0008 Subscriptions
-- Plans, prices, subscriptions, and how membership turns into access.
--
-- Brief §16: do not hard-code one tier. Plans and their entitlement rules
-- are rows, so "Residents get the Heartbreak Anthology" is an editorial
-- decision made in the admin dashboard, not a code change.
-- =====================================================================

create table plans (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,       -- free | resident | patron
  name        text not null,
  description text,
  -- Feature flags the app reads. Keeping this as jsonb avoids a migration
  -- every time a perk is added, and the admin UI writes a known shape.
  features    jsonb not null default '{}'::jsonb,
  -- Blanket access to everything marked premium.
  grants_premium_stories boolean not null default false,
  grants_premium_audio   boolean not null default false,
  grants_ai_companion    boolean not null default false,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger plans_updated_at before update on plans
  for each row execute function set_updated_at();

create table plan_prices (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references plans(id) on delete cascade,
  currency          char(3) not null,
  unit_amount       integer not null,
  interval          text not null default 'month',   -- month | year
  provider          text,
  provider_price_id text,
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  constraint plan_amount_positive check (unit_amount >= 0)
);

create unique index plan_prices_one_default
  on plan_prices (plan_id, currency, interval) where is_default;

-- Specific products bundled into a plan. Granting these produces real
-- entitlement rows with source='subscription' and an expires_at, so the
-- download path stays identical to a purchase — one code path, not two.
create table plan_products (
  plan_id    uuid not null references plans(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (plan_id, product_id)
);

create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  plan_id                 uuid not null references plans(id) on delete restrict,
  status                  subscription_status not null default 'active',
  provider                text not null,
  provider_subscription_id text,
  provider_customer_id    text,
  currency                char(3),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  cancelled_at            timestamptz,
  trial_ends_at           timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create unique index subscriptions_provider_idx
  on subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

-- A reader holds at most one live subscription.
create unique index subscriptions_one_active
  on subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due');

create index subscriptions_expiry_idx on subscriptions (current_period_end)
  where status in ('active', 'trialing');

-- Deferred FK from 0007.
alter table entitlements
  add constraint entitlements_subscription_fk
  foreign key (subscription_id) references subscriptions(id) on delete set null;

-- Does this reader have live premium access, by any route?
create or replace function has_premium_access(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from subscriptions s
    join plans p on p.id = s.plan_id
    where s.user_id = p_user
      and s.status in ('trialing', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
      and p.grants_premium_stories
  );
$func$;

-- Sync a subscription's bundled products into entitlements. Idempotent;
-- called by the webhook on create, renew, and cancel.
create or replace function sync_subscription_entitlements(p_subscription_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_sub record;
  v_granted integer := 0;
begin
  select * into v_sub from subscriptions where id = p_subscription_id;
  if not found then return 0; end if;

  if v_sub.status in ('trialing', 'active', 'past_due') then
    with inserted as (
      insert into entitlements
        (user_id, product_id, source, subscription_id, expires_at)
      select v_sub.user_id, pp.product_id, 'subscription', v_sub.id,
             v_sub.current_period_end
      from plan_products pp
      where pp.plan_id = v_sub.plan_id
      on conflict do nothing
      returning 1
    )
    select count(*) into v_granted from inserted;

    -- Extend the window on renewal for grants already held.
    update entitlements
       set expires_at = v_sub.current_period_end
     where subscription_id = v_sub.id
       and revoked_at is null;
  else
    update entitlements
       set revoked_at = now(),
           revoked_reason = 'subscription_' || v_sub.status
     where subscription_id = v_sub.id
       and revoked_at is null;
  end if;

  return v_granted;
end;
$func$;
