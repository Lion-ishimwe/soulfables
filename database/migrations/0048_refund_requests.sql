-- =====================================================================
-- Soulfables — 0048 Refund requests
--
-- A reader asks for a refund from the receipt instead of writing an
-- email. The request names the order, the reason the policy allows
-- (faulty, changed mind, bought twice, other) and a few words. Only
-- staff decide: refunded, through the payment provider, or declined
-- with a note the reader reads on the receipt. One open request per
-- order; a decided one stays as the record.
-- =====================================================================

create table if not exists refund_requests (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  reason        text not null check (reason in ('faulty', 'changed_mind', 'duplicate', 'other')),
  message       text not null default '',
  status        text not null default 'open' check (status in ('open', 'refunded', 'declined')),
  decision_note text,
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table refund_requests is
  'A reader''s request for a refund on one order. Staff decide on /admin/refunds; the decision is kept.';

create unique index if not exists refund_requests_one_open
  on refund_requests (order_id) where status = 'open';
create index if not exists refund_requests_status_idx on refund_requests (status, created_at desc);

alter table refund_requests enable row level security;

-- The reader sees their own; staff see all.
create policy refund_requests_read on refund_requests
  for select using (user_id = auth.uid() or is_staff());

-- A reader may ask only about an order that is theirs and was paid.
create policy refund_requests_ask on refund_requests
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from orders o
      where o.id = order_id and o.user_id = auth.uid() and o.status = 'paid'
    )
  );

-- Only staff decide.
create policy refund_requests_decide on refund_requests
  for update using (is_staff()) with check (is_staff());
