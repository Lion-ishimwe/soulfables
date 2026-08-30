/**
 * Apply the whole schema to a local PostgreSQL server and prove RLS.
 *
 * Different from database/test/run-migrations.mjs, which uses PGlite —
 * that one needs nothing installed and is what CI runs. This one talks to
 * a real server, which is the only way to exercise RLS as a non-superuser
 * and therefore the only way to prove the policies deny.
 *
 * Needs psql on PATH and a running server. See documentation/local-database.md.
 *
 *   node database/scripts/local.mjs [database]
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Find psql without depending on PATH.
 *
 * A freshly installed Postgres updates the user PATH, but a shell that
 * was already open keeps the old one — so "not found" here usually means
 * "installed, but this terminal has not noticed yet". Looking in the
 * usual places is friendlier than telling someone to restart everything.
 */
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
  return 'psql'; // fall back to PATH and let it fail with its own message
}

const PSQL = findPsql();
const DB = process.argv[2] ?? 'soulfables';
const env = { ...process.env, PGUSER: process.env.PGUSER ?? 'postgres' };

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function psql(args, { quiet = true } = {}) {
  return execFileSync(PSQL, ['-d', DB, '-v', 'ON_ERROR_STOP=1', ...(quiet ? ['-q'] : []), ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function run(file, label) {
  try {
    psql(['-f', file]);
    console.log(`  ${green('ok')} ${label}`);
  } catch (e) {
    console.log(`  ${red('FAIL')} ${label}`);
    console.log((e.stderr ?? e.stdout ?? String(e)).trim().split('\n').slice(-6).join('\n'));
    process.exit(1);
  }
}

console.log(`\nSoulfables — local PostgreSQL (${DB})`);
console.log(`  using ${PSQL}`);

/*
 * Start from nothing.
 *
 * The point of this script is to prove the schema applies to an EMPTY
 * server, which is what a first deploy does. Running it against a
 * database that already has the schema would only prove the migrations
 * are re-runnable — a different, much weaker claim.
 *
 * It therefore DROPS the target database. Safe for the local scratch
 * database it creates, and not safe for anything else, so it refuses a
 * name that looks like somewhere real.
 */
if (/prod|live|main/i.test(DB)) {
  console.error(`\nRefusing to drop a database called "${DB}".`);
  process.exit(1);
}

try {
  execFileSync(PSQL, ['-d', 'postgres', '-q', '-c', `drop database if exists ${DB} with (force)`], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  execFileSync(PSQL, ['-d', 'postgres', '-q', '-c', `create database ${DB}`], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log(`  recreated ${DB} from empty\n`);
} catch (e) {
  console.error('\nCould not prepare the database. Is the server running?');
  console.error(String(e.stderr ?? e.stdout ?? e).trim().split('\n').slice(-4).join('\n'));
  process.exit(1);
}

console.log('Supabase shim');
run(join(ROOT, 'shim', 'supabase-local.sql'), 'auth, storage, roles, auth.uid()');

console.log('\nMigrations');
for (const f of readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  run(join(ROOT, 'migrations', f), f);
}

console.log('\nSeed (twice, to prove idempotence)');
for (const pass of ['first', 'second']) {
  for (const f of readdirSync(join(ROOT, 'seed')).filter((f) => f.endsWith('.sql')).sort()) {
    run(join(ROOT, 'seed', f), `${f} (${pass})`);
  }
}

console.log('\nRLS');
for (const [file, label] of [
  ['rls_coverage.sql', 'every table has a policy'],
  ['rls_enforcement.sql', 'the policies actually deny'],
]) {
  run(join(ROOT, 'checks', file), label);
}

const counts = psql([
  '-tAc',
  `select (select count(*) from pg_tables where schemaname='public') || ' tables, ' ||
          (select count(*) from pg_policies where schemaname='public') || ' policies, ' ||
          (select count(*) from pg_indexes where schemaname='public') || ' indexes'`,
]).trim();

console.log(`\n${green('PASS')} — ${counts}\n`);
