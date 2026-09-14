-- =====================================================================
-- Soulfables — 0037 Errors the House can see
--
-- Until now a failure on the server went to the systemd journal and
-- nowhere else: nobody would know a page had broken unless a reader
-- wrote in. There is no monitoring service, and one is a decision with
-- a bill attached. In the meantime the application records its own
-- request failures here, and Settings → Report shows the last week of
-- them. Enough to notice; not a replacement for alerting.
-- =====================================================================

create table if not exists app_errors (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  message     text not null,
  digest      text,
  stack       text,
  path        text,
  method      text,
  kind        text,      -- render | route | action | middleware
  runtime     text
);

create index app_errors_at_idx on app_errors (at desc);

alter table app_errors enable row level security;

-- Staff read them; the application writes them with the service role.
create policy app_errors_staff_read on app_errors
  for select using (is_staff());

comment on table app_errors is
  'Request failures recorded by the application itself, for Settings → Report. Written with the service role; staff read.';
