-- =====================================================================
-- Soulfables — 0021 Audit everything
--
-- The audit log has existed since 0010 and five server actions wrote to
-- it. Everything else — shelves, authors, accounts, featured placements,
-- settings, roles — changed without leaving a trace, and a log that
-- records five things out of thirty is worse than no log, because it
-- looks complete.
--
-- Application-level auditing cannot fix that. It records what the
-- application remembers to record, and it sees nothing done through the
-- Supabase dashboard, through psql, or by a script holding the service
-- key. A trigger sees every change however it arrives, which is the only
-- version of "everything" worth claiming.
--
-- What is deliberately NOT audited, and why:
--
--   audit_log          auditing the audit log is a loop
--   analytics_events   append-only telemetry, thousands of rows a day
--   reading_progress   changes as a reader scrolls; would drown the rest
--   reading_history    same
--
-- That exclusion list is stated here and shown on the page, because an
-- audit trail with silent gaps is the thing this migration exists to
-- stop.
-- =====================================================================

-- ---------------------------------------------------------------------
-- One trigger function for every table.
--
-- SECURITY DEFINER so it can read auth.users for the actor's email, and
-- so it can write to audit_log regardless of what the caller may do.
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before  jsonb;
  v_after   jsonb;
  v_action  text;
  v_id      uuid;
  v_email   text;
begin
  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after  := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  /*
   * An UPDATE that changed nothing is not an event.
   *
   * updated_at has to be excluded from that comparison, and finding out
   * why took a test: most of these tables carry a BEFORE trigger that
   * bumps updated_at, so by the time this runs the two rows always
   * differ by at least that column. Comparing them raw logged an entry
   * for every save, including the ones where somebody opened a form and
   * pressed save without touching it — the exact noise this check exists
   * to prevent.
   */
  if tg_op = 'UPDATE'
     and (v_before - 'updated_at') = (v_after - 'updated_at') then
    return new;
  end if;

  /*
   * Prose is redacted to a length.
   *
   * A story body is a few thousand characters, and storing both the
   * before and the after on every save would make the audit log larger
   * than the library within a month — while telling a reader of the log
   * nothing they could not get from the story itself.
   */
  if v_before ? 'body_mdx' then
    v_before := jsonb_set(v_before, '{body_mdx}',
      to_jsonb('[' || coalesce(length(v_before->>'body_mdx'), 0) || ' characters]'));
  end if;
  if v_after ? 'body_mdx' then
    v_after := jsonb_set(v_after, '{body_mdx}',
      to_jsonb('[' || coalesce(length(v_after->>'body_mdx'), 0) || ' characters]'));
  end if;

  -- The primary key, where the table has a simple one.
  begin
    v_id := coalesce((v_after->>'id')::uuid, (v_before->>'id')::uuid);
  exception when others then
    v_id := null;
  end;

  /*
   * Intent, where it can be derived.
   *
   * "stories.update" is true and nearly useless; "story.published" is
   * what somebody scanning this log is looking for. Deriving it here
   * rather than in the application means it holds however the change
   * arrived — including from the Supabase dashboard.
   */
  v_action := tg_table_name || '.' || lower(tg_op);

  if tg_table_name = 'stories' and tg_op = 'UPDATE' then
    if v_before->>'status' is distinct from v_after->>'status' then
      v_action := 'story.' || (v_after->>'status');
    end if;
  elsif tg_table_name = 'entitlements' then
    v_action := case tg_op when 'INSERT' then 'entitlement.granted'
                           when 'DELETE' then 'entitlement.revoked'
                           else 'entitlement.updated' end;
  elsif tg_table_name = 'user_roles' then
    v_action := 'role.' || lower(tg_op);
  elsif tg_table_name = 'authors' and tg_op = 'UPDATE'
        and v_before->>'user_id' is distinct from v_after->>'user_id' then
    v_action := case when v_after->>'user_id' is null
                     then 'author.account_revoked'
                     else 'author.account_granted' end;
  end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();

  insert into audit_log (actor_id, actor_email, action, entity_type, entity_id, before, after)
  values (auth.uid(), v_email, v_action, tg_table_name, v_id, v_before, v_after);

  return coalesce(new, old);
end
$$;

comment on function public.audit_row_change() is
  'Records every insert, update and delete on the tables it is attached to, however the change arrived.';

-- ---------------------------------------------------------------------
-- Attach it to everything that is not on the exclusion list.
--
-- Written as a loop over the catalogue rather than a list of table
-- names, so a table added by a future migration is audited by running
-- this again rather than by somebody remembering to add a line.
-- ---------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in (
        'audit_log',          -- auditing the audit log is a loop
        'analytics_events',   -- append-only telemetry, very high volume
        'reading_progress',   -- changes as a reader scrolls
        'reading_history',    -- same
        'schema_migrations'   -- bookkeeping, not a business fact
      )
  loop
    execute format('drop trigger if exists audit_changes on public.%I', t.relname);
    execute format(
      'create trigger audit_changes
         after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()',
      t.relname
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- An index for the filters the page offers. Every query it makes is
-- "newest first, within a window", which is exactly this.
-- ---------------------------------------------------------------------
create index if not exists audit_log_created_at_desc_idx
  on audit_log (created_at desc);

create index if not exists audit_log_entity_type_idx
  on audit_log (entity_type, created_at desc);
