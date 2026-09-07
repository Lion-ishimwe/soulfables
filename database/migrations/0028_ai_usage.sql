-- =====================================================================
-- Soulfables — 0028 What the writing assistant costs
--
-- ask() has always received input_tokens and output_tokens back from the
-- model and thrown them away. So the only way to know what the House
-- spends was the Anthropic console, which knows the total and nothing
-- else: it cannot tell drafting from continuing, or one story from
-- another, because it has never heard of a story.
--
-- This keeps the numbers the console cannot. Not to duplicate their
-- billing — theirs is authoritative and this is an estimate priced from
-- the published rates — but to answer the questions billing cannot:
-- which feature costs the most, which story ran away with it, and
-- whether the key is working at all.
--
-- Every call is recorded, failures included. A refusal for want of
-- credit is the most useful row in the table: it is the moment the
-- assistant stopped working, and until now it surfaced only as a red
-- sentence inside a form somebody had already filled in.
-- =====================================================================

create table ai_usage (
  id            bigserial primary key,

  -- Who asked. Null once an account is deleted: the spend still
  -- happened and the total must not silently drop when somebody leaves.
  actor_id      uuid references auth.users(id) on delete set null,
  actor_email   text,

  -- What was asked for: draft | continue | titles | companion.
  -- Free text rather than an enum so a new feature can record itself
  -- without a migration; the page groups on whatever it finds.
  job           text not null,

  model         text not null,
  story_id      uuid references stories(id) on delete set null,

  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,

  -- USD in millionths, as an integer.
  --
  -- Money in floating point is a class of bug this table would invite:
  -- one call can cost $0.0004, and a year of them summed as doubles
  -- drifts. Micros keep every arithmetic exact, and a single call is
  -- still hundreds of them, so nothing rounds to zero.
  cost_micros   bigint not null default 0,

  ok            boolean not null default true,
  -- Present only on failure. The provider's own words, so "credit
  -- balance is too low" survives to the page that should show it.
  error         text,
  -- Coarse reason, for asking "is the key working" without matching on
  -- prose: auth | credit | rate_limit | overloaded | timeout | unreachable | refused
  failure_kind  text,

  duration_ms   integer,
  created_at    timestamptz not null default now()
);

create index ai_usage_recent_idx on ai_usage (created_at desc);
create index ai_usage_job_idx    on ai_usage (job, created_at desc);
create index ai_usage_story_idx  on ai_usage (story_id) where story_id is not null;
create index ai_usage_failed_idx on ai_usage (created_at desc) where not ok;

comment on table ai_usage is
  'One row per model call. Cost is an estimate from published rates, not a billing record — Anthropic''s console is authoritative for what is owed.';

-- ---------------------------------------------------------------------
-- RLS.
--
-- Same shape as analytics_events, and for the same reason: the thing
-- doing the writing is a signed-in author who must not be able to read
-- the House's spending back. Insert is open to anyone signed in; reading
-- is staff only.
-- ---------------------------------------------------------------------
alter table ai_usage enable row level security;

create policy ai_usage_insert on ai_usage
  for insert to authenticated
  with check (actor_id is null or actor_id = auth.uid());

create policy ai_usage_read_staff on ai_usage
  for select to authenticated
  using (is_staff());

-- ---------------------------------------------------------------------
-- The rollup the Billing page reads.
--
-- One request rather than six. The page wants a total, a per-feature
-- split, a per-story split and a per-author split over the same window,
-- and asking four times means four round trips to Frankfurt for sums the
-- database can do in one pass.
-- ---------------------------------------------------------------------
create or replace function public.ai_spend_report(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, p_days));
  v_out   jsonb;
begin
  if not is_staff() then
    raise exception 'Only staff may read what the House spends.';
  end if;

  select jsonb_build_object(
    'since', v_since,

    'totals', (
      select jsonb_build_object(
        'calls',         count(*),
        'failed',        count(*) filter (where not ok),
        'input_tokens',  coalesce(sum(input_tokens), 0),
        'output_tokens', coalesce(sum(output_tokens), 0),
        'cost_micros',   coalesce(sum(cost_micros), 0)
      ) from ai_usage where created_at >= v_since
    ),

    -- Lifetime, so the page can say what the assistant has cost since it
    -- was switched on, not only within the window being looked at.
    'lifetime', (
      select jsonb_build_object(
        'calls',       count(*),
        'cost_micros', coalesce(sum(cost_micros), 0),
        'first_call',  min(created_at)
      ) from ai_usage
    ),

    'by_job', (
      select coalesce(jsonb_agg(x order by x->>'cost_micros' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'job', job,
                 'calls', count(*),
                 'cost_micros', coalesce(sum(cost_micros), 0),
                 'output_tokens', coalesce(sum(output_tokens), 0)
               ) as x
        from ai_usage where created_at >= v_since group by job
      ) t
    ),

    'by_story', (
      select coalesce(jsonb_agg(x order by (x->>'cost_micros')::bigint desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'slug', s.slug,
                 'title', s.title,
                 'calls', count(*),
                 'cost_micros', coalesce(sum(u.cost_micros), 0)
               ) as x
        from ai_usage u
        join stories s on s.id = u.story_id
        where u.created_at >= v_since
        group by s.slug, s.title
        limit 12
      ) t
    ),

    'by_author', (
      select coalesce(jsonb_agg(x order by (x->>'cost_micros')::bigint desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'email', coalesce(actor_email, 'unattributed'),
                 'calls', count(*),
                 'cost_micros', coalesce(sum(cost_micros), 0)
               ) as x
        from ai_usage where created_at >= v_since
        group by actor_email
      ) t
    ),

    'by_day', (
      select coalesce(jsonb_agg(x order by x->>'day'), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'day', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
                 'cost_micros', coalesce(sum(cost_micros), 0)
               ) as x
        from ai_usage where created_at >= v_since
        group by date_trunc('day', created_at)
      ) t
    ),

    -- The last failure, whatever the window. A key that stopped working
    -- five weeks ago is still not working, and a report that hid it
    -- because the window is thirty days would be worse than no report.
    'last_failure', (
      select jsonb_build_object(
               'at', created_at,
               'kind', failure_kind,
               'error', error,
               'job', job
             )
      from ai_usage where not ok order by created_at desc limit 1
    ),

    'last_success', (
      select jsonb_build_object('at', created_at, 'model', model)
      from ai_usage where ok order by created_at desc limit 1
    )
  ) into v_out;

  return v_out;
end
$$;

comment on function public.ai_spend_report(integer) is
  'Everything the Billing page shows, in one request. Staff only.';

grant execute on function public.ai_spend_report(integer) to authenticated;
