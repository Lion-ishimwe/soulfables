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
 * Connection comes from SUPABASE_DB_URL, or --url. Get it from the
 * Connect button in the dashboard header — it is no longer in Settings.
 *
 * Any connection on port 5432 works. Port 6543 does not: that is the
 * TRANSACTION pooler, which cannot run DDL. The distinction that catches
 * people is that Supabase offers two poolers and only the port tells
 * them apart.
 *
 *   Direct           db.REF.supabase.co:5432          IPv6 only on Free
 *   Session pooler   aws-N-REGION.pooler.supabase.com:5432   IPv4, fine
 *   Transaction      aws-N-REGION.pooler.supabase.com:6543   NO
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { normalise, mask, explain } from './connection.mjs';

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
    const raw = readFileSync(envFile);

    /*
     * PowerShell 5.1's >> writes UTF-16LE. The file looks completely
     * normal in an editor and parses as gibberish here, so say what has
     * happened rather than reporting the key as missing.
     */
    if (raw[0] === 0xff || raw[0] === 0xfe) {
      console.error(
        [
          '',
          red('.env.local is UTF-16, not UTF-8.'),
          '',
          "PowerShell's >> operator does that. Nothing can read it — not",
          'this script and not Next.',
          '',
          'Rewrite it with:  npm run db:setup',
          '',
        ].join('\n')
      );
      process.exit(1);
    }

    const line = raw
      .toString('utf8')
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith('SUPABASE_DB_URL='));
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const RAW_URL = connectionString();
if (!RAW_URL) {
  console.error(
    [
      '',
      red('No connection string.'),
      '',
      'Set SUPABASE_DB_URL in .env.local, or pass --url.',
      '',
      'In the Supabase dashboard, press Connect in the header bar — it is',
      'not under Settings any more.',
      '',
      'Take a connection string on port 5432. Either the direct one or',
      'the Session pooler will do; on the Free plan the direct host is',
      'IPv6-only, so an IPv4 network needs the Session pooler.',
      '',
      'Not port 6543. That is the transaction pooler and cannot run DDL.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

/*
 * Catch the transaction pooler before it wastes anyone's afternoon.
 *
 * Port 6543 connects perfectly well and then fails partway through a
 * migration with something about prepared statements, which reads like a
 * schema bug rather than a wrong hostname. Cheaper to say so up front.
 */
if (/:6543(\/|$|\?)/.test(RAW_URL)) {
  console.error(
    [
      '',
      red('That is the transaction pooler (port 6543).'),
      '',
      'It cannot run migrations — DDL needs a session, and this pooler',
      'does not give you one. It will connect and then fail partway',
      'through, in a way that looks like a schema problem.',
      '',
      'Use port 5432 instead. In the Connect dialog that is either the',
      'direct connection or the Session pooler; on the Free plan the',
      'direct host is IPv6-only, so on an IPv4 network take the Session',
      'pooler.',
      '',
    ].join('\n')
  );
  process.exit(1);
}

/*
 * Normalise before use. A password containing @ or / splits the URL in
 * the wrong place, and libpq then blames DNS for it.
 */
const { url: DB_URL, notes: URL_NOTES, host: DB_HOST } = normalise(RAW_URL);

/** Masks on the LAST @, so no part of the password reaches the screen. */
const SAFE = mask(DB_URL);

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
for (const n of URL_NOTES) console.log(dim('  ' + n));

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
  for (const line of explain(msg, DB_HOST)) console.error(dim(line));
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
