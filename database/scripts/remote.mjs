/**
 * Apply the schema to a real, remote project — a Supabase database.
 *
 * Deliberately NOT the same script as local.mjs, because the two are
 * doing opposite things:
 *
 *   local.mjs   drops the database and replays everything.
 *               Proves the schema applies to an empty server.
 *
 *   remote.mjs  never drops anything, ever. Applies only what has not
 *               been applied, and records what it did.
 *
 * A live project holds somebody's data. Replaying a migration that has
 * already run is at best noisy and at worst destructive, so this one
 * keeps a schema_migrations table and advances past it.
 *
 * Default mode is INSPECT — it connects, tells you what is already
 * there, and changes nothing. You have to ask for --apply.
 *
 *   node database/scripts/remote.mjs                  # look, change nothing
 *   node database/scripts/remote.mjs --apply          # apply pending migrations
 *   node database/scripts/remote.mjs --apply --seed   # and load the house content
 *
 * Connection comes from SUPABASE_DB_URL, or --url. Use the DIRECT
 * connection (port 5432), not the transaction pooler (6543) — pooled
 * connections cannot run DDL reliably.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

// --- where is psql ----------------------------------------------------
function findPsql() {
  if (process.env.PGBIN) return join(process.env.PGBIN, 'psql');
  const candidates = [
    join(homedir(), 'scoop', 'apps', 'postgresql', 'current', 'bin', 'psql.exe'),
    join('C:', 'Program Files', 'PostgreSQL', '17', 'bin', 'psql.exe'),
    join('C:', 'Program Files', 'PostgreSQL', '16', 'bin', 'psql.exe'),
    '/usr/bin/psql',
    '/usr/local/bin/psql',
    '/opt/homebrew/bin/psql',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return 'psql';
}
const PSQL = findPsql();

// --- where is the database -------------------------------------------
/**
 * Read SUPABASE_DB_URL from the environment or from .env.local, so the
 * connection string lives in the file that is already gitignored rather
 * than in shell history.
 */
function connectionString() {
  const flag = process.argv.indexOf('--url');
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const envFile = join(REPO, '.env.local');
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('SUPABASE_DB_URL='));
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const DB_URL = connectionString();
if (!DB_URL) {
  console.error(
    [
      '',
      red('No connection string.'),
      '',
      'Set SUPABASE_DB_URL in .env.local, or pass --url.',
      '',
      'Find it in the Supabase dashboard under',
      '  Project Settings → Database → Connection string → URI',
      '',
      'Use the DIRECT connection on port 5432. The pooled one on 6543',
      'cannot run migrations.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

/** Never print the password back to a terminal or a log. */
const SAFE = DB_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:******@');

function sql(text) {
  return execFileSync(PSQL, [DB_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', text], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runFile(path) {
  return execFileSync(PSQL, [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-f', path], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// --- look before touching --------------------------------------------
console.log('\n' + bold('Soulfables — remote database'));
console.log(dim('  ' + SAFE) + '\n');

/*
 * Connecting and querying are separate failures and deserve separate
 * messages. Reporting "could not connect" because one probe raised is
 * how someone spends an hour on the wrong problem.
 */
let existing;
try {
  existing = {
    version: sql('show server_version'),
    db: sql('select current_database()'),
    tables: Number(sql("select count(*) from pg_tables where schemaname='public'")),
    policies: Number(sql("select count(*) from pg_policies where schemaname='public'")),
    hasVector: sql("select count(*) from pg_extension where extname='vector'") !== '0',
  };
} catch (e) {
  const msg = String(e.stderr ?? e.stdout ?? e).trim();
  console.error(red('Could not connect.') + '\n' + msg.split('\n').slice(-4).join('\n') + '\n');
  if (/Tenant or user not found|password authentication/i.test(msg)) {
    console.error(dim('That usually means the password in the URL is wrong, or the'));
    console.error(dim('pooled host was used with a direct-connection username.') + '\n');
  }
  process.exit(1);
}

/*
 * A hosted Supabase project always has auth.users, and every table that
 * belongs to a person references it. A bare Postgres does not — so its
 * absence is not an error here, it is the answer to "is this actually a
 * Supabase project", and the migrations will not apply without it.
 */
let accounts = null;
try {
  accounts = sql('select count(*) from auth.users');
} catch {
  /* no auth schema — reported below */
}

console.log(`  PostgreSQL ${existing.version} · database ${existing.db}`);
console.log(`  ${existing.tables} tables, ${existing.policies} policies in public`);
console.log(
  accounts === null
    ? '  ' + red('no auth schema') + dim(' — not a Supabase project')
    : `  ${accounts} account(s) in auth.users`
);
console.log(`  pgvector ${existing.hasVector ? green('available') : dim('not installed')}`);

if (accounts === null) {
  console.log(
    [
      '',
      'These migrations reference auth.users, which a hosted Supabase',
      'project provides and a bare PostgreSQL server does not.',
      '',
      'For a plain server, use the local script instead — it installs a',
      'shim for exactly this and then proves RLS:',
      '',
      '  npm run db:local',
      '',
    ].join('\n')
  );
  process.exit(1);
}

// --- what has already been applied -----------------------------------
const tracked =
  sql(
    "select count(*) from information_schema.tables where table_schema='public' and table_name='schema_migrations'"
  ) !== '0';

/*
 * Split on \r?\n and trim, not on \n.
 *
 * psql on Windows terminates rows with CRLF, so a plain split leaves a
 * trailing \r on every name and none of them match the filenames. The
 * symptom is the worst kind: the script reports "14 already applied" and
 * then lists all 14 as pending, and re-runs every migration against a
 * live database. Caught by re-running it; it would not have shown up in
 * a single pass.
 */
const applied = new Set(
  tracked
    ? sql('select name from schema_migrations')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
);

const all = readdirSync(join(ROOT, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();
const pending = all.filter((f) => !applied.has(f));

console.log('\n' + bold('Migrations'));
if (applied.size) console.log(dim(`  ${applied.size} already applied`));
if (!pending.length) {
  console.log('  ' + green('up to date') + ' — nothing to apply\n');
} else {
  for (const f of pending) console.log('  ' + dim('pending') + ' ' + f);
}

const APPLY = process.argv.includes('--apply');
const SEED = process.argv.includes('--seed');

if (!APPLY) {
  console.log('\n' + dim('Inspect only — nothing was changed.'));
  if (pending.length) {
    console.log(`\nTo apply the ${pending.length} pending migration(s):\n`);
    console.log('  node database/scripts/remote.mjs --apply\n');
  }
  process.exit(0);
}

/*
 * A project that already has tables the schema does not know about is
 * either somebody else's project, or this one in a state this script
 * cannot reason about. Stop rather than guess — the cost of guessing
 * wrong here is somebody's live data.
 */
if (existing.tables > 0 && !tracked) {
  console.log(
    [
      '',
      red('Refusing to apply.'),
      '',
      `This database already has ${existing.tables} table${existing.tables === 1 ? "" : "s"} in public but no`,
      'schema_migrations record, so this script cannot tell what is already',
      'there or whether these migrations would conflict with it.',
      '',
      'If those tables are an earlier hand-run of these same migrations,',
      'record that first:',
      '',
      '  create table schema_migrations (',
      '    name text primary key,',
      '    applied_at timestamptz not null default now()',
      '  );',
      '',
      'then insert the filenames already applied and re-run.',
      '',
      'If they are something else, use a different project.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

// --- apply ------------------------------------------------------------
sql(
  `create table if not exists schema_migrations (
     name text primary key,
     applied_at timestamptz not null default now()
   )`
);

console.log('');
for (const f of pending) {
  try {
    runFile(join(ROOT, 'migrations', f));
    sql(`insert into schema_migrations (name) values ('${f}') on conflict do nothing`);
    console.log('  ' + green('ok') + ' ' + f);
  } catch (e) {
    console.log('  ' + red('FAIL') + ' ' + f);
    console.log(String(e.stderr ?? e.stdout ?? e).trim().split('\n').slice(-8).join('\n'));
    console.log('\n' + dim('Stopped here. Everything already applied is recorded, so'));
    console.log(dim('fixing the problem and re-running resumes from this file') + '\n');
    process.exit(1);
  }
}

if (SEED) {
  console.log('\n' + bold('Seed'));
  for (const f of readdirSync(join(ROOT, 'seed')).filter((x) => x.endsWith('.sql')).sort()) {
    try {
      runFile(join(ROOT, 'seed', f));
      console.log('  ' + green('ok') + ' ' + f);
    } catch (e) {
      console.log('  ' + red('FAIL') + ' ' + f);
      console.log(String(e.stderr ?? e.stdout ?? e).trim().split('\n').slice(-8).join('\n'));
      process.exit(1);
    }
  }
}

const after = sql(
  `select (select count(*) from pg_tables where schemaname='public') || ' tables, ' ||
          (select count(*) from pg_policies where schemaname='public') || ' policies'`
);
console.log('\n' + green('DONE') + ' — ' + after + '\n');
