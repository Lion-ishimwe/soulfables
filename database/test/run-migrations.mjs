/**
 * Schema verification harness.
 *
 * Runs every migration, then the seed, then the RLS coverage check
 * against a real Postgres — PGlite, which is Postgres compiled to WASM
 * and running in-process. No Docker, no server, no Supabase project.
 *
 * What this proves: the SQL is valid, the migrations apply in order, the
 * constraints and indexes build, the seed is idempotent, and every table
 * carries an RLS policy.
 *
 * What it does NOT prove: that RLS actually denies a real reader. PGlite
 * has no Supabase Auth, so `auth.uid()` is stubbed to null and policies
 * are created but never exercised under a live session. That check needs
 * a real project and two accounts — it is milestone M4.
 *
 * Run: node database/test/run-migrations.mjs
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// pgvector is not among PGlite's bundled extensions, which is exactly
// why migration 0004 creates the embedding column conditionally. Its
// absence here is the portability guarantee being exercised, not a gap.
const db = await PGlite.create({
  extensions: { pgcrypto, pg_trgm, unaccent },
});

/**
 * Stand up what Supabase provides and PGlite does not: the auth and
 * storage schemas, the three roles, and auth.uid(). Mirrors the same
 * shim used in CI so the two environments agree.
 */
async function shim() {
  await db.exec(`
    create schema if not exists auth;
    create schema if not exists storage;
    create role anon;
    create role authenticated;
    create role service_role;

    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );

    create table storage.buckets (
      id text primary key,
      name text,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );

    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text,
      name text
    );

    create or replace function auth.uid() returns uuid
      language sql stable as $$ select null::uuid $$;
  `);
}

async function runDir(dir, label) {
  const files = readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const f of files) {
    const sql = readFileSync(join(ROOT, dir, f), 'utf8');
    try {
      await db.exec(sql);
      console.log(`  ${green('ok')} ${label}/${f}`);
    } catch (e) {
      console.log(`  ${red('FAIL')} ${label}/${f}`);
      console.log(`       ${e.message}`);
      process.exitCode = 1;
      throw e;
    }
  }
  return files.length;
}

console.log('\nSoulfables — schema verification (PGlite)\n');

await shim();
console.log(dim('  Supabase auth/storage shim installed\n'));

console.log('Migrations');
const migrations = await runDir('migrations', 'migrations');

console.log('\nSeed');
await runDir('seed', 'seed');

console.log('\nSeed again (must be idempotent)');
await runDir('seed', 'seed');

console.log('\nRLS coverage');
try {
  const check = readFileSync(join(ROOT, 'checks', 'rls_coverage.sql'), 'utf8');
  await db.exec(check);
  console.log(`  ${green('ok')} every table has RLS and a policy`);
} catch (e) {
  console.log(`  ${red('FAIL')} ${e.message}`);
  process.exitCode = 1;
}

// --- What actually landed ---------------------------------------------
const counts = await db.query(`
  select
    (select count(*) from pg_tables where schemaname = 'public') as tables,
    (select count(*) from pg_policies where schemaname = 'public') as policies,
    (select count(*) from pg_indexes where schemaname = 'public') as indexes,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public') as functions
`);

const seeded = await db.query(`
  select
    (select count(*) from shelves) as shelves,
    (select count(*) from themes) as themes,
    (select count(*) from moods) as moods,
    (select count(*) from authors) as authors,
    (select count(*) from products) as products,
    (select count(*) from product_prices) as prices,
    (select count(*) from product_bundle_items) as bundle_items,
    (select count(*) from shelf_journeys) as journeys,
    (select count(*) from plans) as plans
`);

console.log('\nSchema');
console.table(counts.rows[0]);
console.log('Seeded rows');
console.table(seeded.rows[0]);

// --- Behavioural checks on the parts that carry real risk -------------
console.log('\nBehaviour');

const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push([name, true, detail ?? '']);
  } catch (e) {
    checks.push([name, false, e.message]);
    process.exitCode = 1;
  }
}

// Order references must be unique and human-readable.
await check('order reference sequence', async () => {
  const a = await db.query(`select next_order_reference() as r`);
  const b = await db.query(`select next_order_reference() as r`);
  const ra = a.rows[0].r;
  const rb = b.rows[0].r;
  if (ra === rb) throw new Error('references collided');
  if (!/^SF-\d{4}-\d{4}$/.test(ra)) throw new Error(`bad shape: ${ra}`);
  return `${ra} then ${rb}`;
});

// A published story with no published_at must be rejected.
await check('published story requires a date', async () => {
  try {
    await db.exec(`
      insert into stories (slug, title, status)
      values ('constraint-probe', 'Probe', 'published')
    `);
  } catch {
    return 'constraint held';
  }
  throw new Error('a published story was accepted with no published_at');
});

// The heart of §23: buying a bundle must grant every product inside it.
await check('bundle purchase fans out to its contents', async () => {
  await db.exec(`
    insert into auth.users (id, email)
    values ('11111111-1111-1111-1111-111111111111', 'buyer@example.com')
  `);

  const bundle = await db.query(
    `select id from products where slug = 'the-soulfables-library'`,
  );
  const bundleId = bundle.rows[0].id;

  const order = await db.query(
    `insert into orders (user_id, email, status, provider, currency,
                         subtotal_amount, total_amount)
     values ('11111111-1111-1111-1111-111111111111', 'buyer@example.com',
             'pending', 'stripe', 'USD', 4500, 4500)
     returning id, reference`,
  );
  const orderId = order.rows[0].id;

  await db.query(
    `insert into order_items (order_id, product_id, title_snapshot, unit_amount, currency)
     values ($1, $2, 'The Soulfables Library', 4500, 'USD')`,
    [orderId, bundleId],
  );

  const granted = await db.query(
    `select grant_entitlements_for_order($1) as n`,
    [orderId],
  );

  const n = Number(granted.rows[0].n);
  // Four children in the bundle, plus the bundle product itself.
  if (n !== 5) throw new Error(`expected 5 entitlements, got ${n}`);

  // Re-running must not double-grant.
  const again = await db.query(
    `select grant_entitlements_for_order($1) as n`,
    [orderId],
  );
  if (Number(again.rows[0].n) !== 0) {
    throw new Error('re-running the grant produced duplicates');
  }

  return `${n} entitlements, idempotent on repeat`;
});

// Access must actually be checkable, and must disappear on refund.
await check('has_entitlement, and refund revokes', async () => {
  const p = await db.query(
    `select id from products where slug = 'the-version-of-me-you-broke'`,
  );
  const productId = p.rows[0].id;

  const before = await db.query(
    `select has_entitlement('11111111-1111-1111-1111-111111111111', $1) as ok`,
    [productId],
  );
  if (before.rows[0].ok !== true) throw new Error('bundle buyer was not entitled');

  const order = await db.query(
    `select id from orders where email = 'buyer@example.com' limit 1`,
  );
  await db.query(`select revoke_entitlements_for_order($1, 'refund')`, [
    order.rows[0].id,
  ]);

  const after = await db.query(
    `select has_entitlement('11111111-1111-1111-1111-111111111111', $1) as ok`,
    [productId],
  );
  if (after.rows[0].ok !== false) throw new Error('access survived a refund');

  return 'entitled before, revoked after';
});

// A revoked grant must not block buying again.
await check('re-purchase after refund is allowed', async () => {
  const p = await db.query(
    `select id from products where slug = 'the-soul-journal'`,
  );
  await db.query(
    `insert into entitlements (user_id, product_id, source)
     values ('11111111-1111-1111-1111-111111111111', $1, 'purchase')`,
    [p.rows[0].id],
  );
  return 'partial unique index permits it';
});

// A guest order must claim on signup.
await check('guest order claims on account creation', async () => {
  await db.exec(`
    insert into auth.users (id, email)
    values ('22222222-2222-2222-2222-222222222222', 'guest@example.com')
  `);

  const p = await db.query(
    `select id from products where slug = 'the-reflection-deck'`,
  );

  const o = await db.query(
    `insert into orders (user_id, email, status, provider, currency,
                         subtotal_amount, total_amount, paid_at)
     values (null, 'guest@example.com', 'paid', 'stripe', 'USD', 1500, 1500, now())
     returning id`,
  );
  await db.query(
    `insert into order_items (order_id, product_id, title_snapshot, unit_amount, currency)
     values ($1, $2, 'The Reflection Deck', 1500, 'USD')`,
    [o.rows[0].id, p.rows[0].id],
  );

  const claimed = await db.query(
    `select claim_orders_for_user(
       '22222222-2222-2222-2222-222222222222', 'guest@example.com') as n`,
  );

  if (Number(claimed.rows[0].n) < 1) {
    throw new Error('the guest order was not claimed');
  }
  return `${claimed.rows[0].n} entitlement granted on signup`;
});

// Webhook idempotency rests on this index.
await check('duplicate webhook event is rejected', async () => {
  await db.query(
    `insert into webhook_events (provider, provider_event_id, event_type, payload)
     values ('stripe', 'evt_test_1', 'payment.succeeded', '{}'::jsonb)`,
  );
  try {
    await db.query(
      `insert into webhook_events (provider, provider_event_id, event_type, payload)
       values ('stripe', 'evt_test_1', 'payment.succeeded', '{}'::jsonb)`,
    );
  } catch {
    return 'unique index held';
  }
  throw new Error('a duplicate event id was accepted');
});

// One primary shelf per story, enforced by a partial unique index.
await check('a story has at most one primary shelf', async () => {
  await db.exec(`
    insert into stories (slug, title, status, published_at)
    values ('probe-story', 'Probe', 'published', now())
  `);
  const s = await db.query(`select id from stories where slug = 'probe-story'`);
  const shelves = await db.query(`select id from shelves limit 2`);

  await db.query(
    `insert into story_shelves (story_id, shelf_id, is_primary) values ($1, $2, true)`,
    [s.rows[0].id, shelves.rows[0].id],
  );

  try {
    await db.query(
      `insert into story_shelves (story_id, shelf_id, is_primary) values ($1, $2, true)`,
      [s.rows[0].id, shelves.rows[1].id],
    );
  } catch {
    return 'partial unique index held';
  }
  throw new Error('a story was given two primary shelves');
});

// Full-text search must be generated, not maintained by hand.
await check('story search vector is generated', async () => {
  await db.query(
    `update stories set body_mdx = 'the house remembered everything'
      where slug = 'probe-story'`,
  );
  const r = await db.query(
    `select count(*) as n from stories
      where slug = 'probe-story'
        and search_vector @@ to_tsquery('english', 'remembered')`,
  );
  if (Number(r.rows[0].n) !== 1) throw new Error('search vector did not update');
  return 'tsvector tracks the body automatically';
});

console.log();
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? green('ok') : red('FAIL')} ${name}${detail ? dim(` — ${detail}`) : ''}`);
}

const failed = checks.filter(([, ok]) => !ok).length;
console.log(
  `\n${failed === 0 ? green('PASS') : red(`${failed} FAILED`)} — ` +
    `${migrations} migrations, ${counts.rows[0].tables} tables, ` +
    `${counts.rows[0].policies} policies, ${checks.length} behavioural checks\n`,
);

await db.close();
