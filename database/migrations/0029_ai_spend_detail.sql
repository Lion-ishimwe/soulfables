-- =====================================================================
-- Soulfables — 0029 More detail for the Billing page
--
-- The first cut of ai_spend_report answered "how much" per feature,
-- story and person. The page now shows tokens beside every cost, a
-- cover beside every story, a status per story, and the last few calls
-- as a plain list — the thing a person actually looks at when the
-- assistant misbehaves. Same one request; a wider answer.
-- =====================================================================

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

    'lifetime', (
      select jsonb_build_object(
        'calls',       count(*),
        'cost_micros', coalesce(sum(cost_micros), 0),
        'first_call',  min(created_at)
      ) from ai_usage
    ),

    'by_job', (
      select coalesce(jsonb_agg(x order by (x->>'cost_micros')::bigint desc, x->>'job'), '[]'::jsonb)
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
      select coalesce(jsonb_agg(x order by (x->>'cost_micros')::bigint desc, (x->>'calls')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'slug', s.slug,
                 'title', s.title,
                 'cover_image', s.cover_image,
                 'calls', count(*),
                 'failed', count(*) filter (where not u.ok),
                 'output_tokens', coalesce(sum(u.output_tokens), 0),
                 'cost_micros', coalesce(sum(u.cost_micros), 0)
               ) as x
        from ai_usage u
        join stories s on s.id = u.story_id
        where u.created_at >= v_since
        group by s.slug, s.title, s.cover_image
        limit 12
      ) t
    ),

    'by_author', (
      select coalesce(jsonb_agg(x order by (x->>'cost_micros')::bigint desc, (x->>'calls')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'email', coalesce(actor_email, 'unattributed'),
                 'calls', count(*),
                 'output_tokens', coalesce(sum(output_tokens), 0),
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

    -- The last few calls, newest first, whatever the window. This is the
    -- list a person reads when something has gone wrong: what was asked,
    -- on which story, and what the model said back.
    'recent', (
      select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'at', u.created_at,
                 'job', u.job,
                 'story_slug', s.slug,
                 'story_title', s.title,
                 'email', u.actor_email,
                 'cost_micros', u.cost_micros,
                 'output_tokens', u.output_tokens,
                 'ok', u.ok,
                 'failure_kind', u.failure_kind
               ) as x
        from ai_usage u
        left join stories s on s.id = u.story_id
        order by u.created_at desc
        limit 8
      ) t
    ),

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
