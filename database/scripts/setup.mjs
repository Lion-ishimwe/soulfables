/**
 * Write .env.local, interactively, without the secrets going anywhere
 * they shouldn't.
 *
 * This exists because the manual version has three traps and someone
 * hits at least one of them:
 *
 *   - `echo '...' >> .env.local` in PowerShell 5.1 writes UTF-16LE, and
 *     the resulting file cannot be read by this repo or by Next.
 *   - Run from the wrong directory it lands somewhere harmless and
 *     invisible, and everything afterwards says "no connection string".
 *   - The connection string contains a password, so pasting it into a
 *     terminal puts it in shell history and into a chat transcript.
 *
 * Prompts are muted for anything secret, the file is written UTF-8 with
 * LF, existing keys are preserved, and the connection is tested before
 * anything is saved.
 *
 *   node database/scripts/setup.mjs
 */
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV = join(REPO, '.env.local');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

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

/*
 * Two input paths, deliberately.
 *
 * Interactive is the real one: readline, with the echo muted for
 * anything secret. Piped input is how this gets tested, and readline
 * behaves badly there — a question can resolve empty while answers are
 * still queued. So when stdin is not a terminal, read it once up front
 * and answer from the list.
 */
const SCRIPTED = !process.stdin.isTTY;
// Split on LF and trim, which also disposes of CR on Windows.
const queued = SCRIPTED
  ? readFileSync(0, 'utf8').split(String.fromCharCode(10)).map((s) => s.trim())
  : [];

const rl = SCRIPTED
  ? null
  : createInterface({ input: process.stdin, output: process.stdout });

/**
 * Ask for something. `secret` mutes the echo, so a password does not
 * end up on screen or in a screenshot.
 */
function ask(question, { secret = false, allowBlank = false } = {}) {
  return new Promise((resolve) => {
    const prompt = `${question}\n${dim('> ')}`;

    if (SCRIPTED) {
      const a = (queued.shift() ?? '').trim();
      console.log(prompt + (secret && a ? '*'.repeat(a.length) : a));
      resolve(a);
      return;
    }
    /*
     * Masking rewrites the current line, which only exists on a TTY.
     * Piped input has no line to rewrite and nobody watching it, so skip
     * the masking rather than crash on clearLine — which is how this
     * gets tested at all.
     */
    if (!secret || !process.stdout.isTTY) {
      rl.question(prompt, (a) => resolve(a.trim()));
      return;
    }
    process.stdout.write(prompt);
    const onData = (char) => {
      // Re-print the prompt line without the typed characters.
      // Enter is not part of the value, so it must not add a star.
      const code = String(char).charCodeAt(0);
      if (code !== 10 && code !== 13) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(dim('> ') + '*'.repeat(rl.line?.length ?? 0));
      }
    };
    process.stdin.on('data', onData);
    rl.question('', (a) => {
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(a.trim());
    });
  }).then((a) => (a === '' && !allowBlank ? null : a));
}

/** Existing values are kept unless replaced, so re-running is safe. */
function readExisting() {
  if (!existsSync(ENV)) return {};
  const raw = readFileSync(ENV);
  if (raw[0] === 0xff || raw[0] === 0xfe) {
    console.log(
      '\n' +
        red('The existing .env.local is UTF-16.') +
        '\n' +
        dim('Almost certainly written by PowerShell >>. It will be rewritten as UTF-8.\n')
    );
    return {};
  }
  const out = {};
  for (const line of raw.toString('utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

console.log('\n' + bold('Soulfables — connect to Supabase') + '\n');
console.log(dim('Press Connect in the dashboard header for the connection string,'));
console.log(dim('and Settings → API Keys for the keys. Enter to skip any field.\n'));

const env = readExisting();
if (Object.keys(env).length) {
  console.log(dim(`Keeping ${Object.keys(env).length} value(s) already in .env.local.\n`));
}

// --- connection string ------------------------------------------------
const dbUrl = await ask(
  bold('Database connection string') +
    dim('\n  Connect → Session pooler (port 5432). Input is hidden.'),
  { secret: true }
);

if (dbUrl) {
  if (/:6543(\/|$|\?)/.test(dbUrl)) {
    console.log('\n' + red('That is the transaction pooler (6543) — it cannot run migrations.'));
    console.log(dim('Take the Session pooler or direct string, both on 5432.\n'));
    rl?.close();
    process.exit(1);
  }
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
    console.log('\n' + red('That does not look like a connection string.'));
    console.log(dim('It should begin postgresql:// — copy the whole URI.\n'));
    rl?.close();
    process.exit(1);
  }
  env.SUPABASE_DB_URL = dbUrl;

  /*
   * The project ref is in the host of every form of the string, so the
   * API URL can be derived rather than asked for. One less thing to
   * paste, one less thing to paste wrong.
   */
  const ref =
    dbUrl.match(/db\.([a-z0-9]{20})\.supabase\.co/)?.[1] ??
    dbUrl.match(/postgres\.([a-z0-9]{20})[:@]/)?.[1];
  if (ref && !env.NEXT_PUBLIC_SUPABASE_URL) {
    env.NEXT_PUBLIC_SUPABASE_URL = `https://${ref}.supabase.co`;
    console.log(dim(`  derived NEXT_PUBLIC_SUPABASE_URL for project ${ref}`));
  }
}

// --- keys -------------------------------------------------------------
if (!env.NEXT_PUBLIC_SUPABASE_URL) {
  const u = await ask(bold('\nProject URL') + dim('\n  Settings → API Keys, https://….supabase.co'));
  if (u) env.NEXT_PUBLIC_SUPABASE_URL = u;
}

const anon = await ask(
  bold('\nAnon / publishable key') + dim('\n  Public by design — still subject to RLS.')
);
if (anon) env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;

const service = await ask(
  bold('\nService role / secret key') +
    dim('\n  BYPASSES RLS. Server-side only. Input is hidden.'),
  { secret: true }
);
if (service) env.SUPABASE_SERVICE_ROLE_KEY = service;

rl?.close();

// --- test before saving -----------------------------------------------
if (env.SUPABASE_DB_URL) {
  process.stdout.write('\n' + dim('Testing the connection… '));
  try {
    const v = execFileSync(findPsql(), [env.SUPABASE_DB_URL, '-tAc', 'select version()'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20000,
    }).trim();
    console.log(green('connected'));
    console.log(dim('  ' + v.split(',')[0]));
  } catch (e) {
    const msg = String(e.stderr ?? e.stdout ?? e).trim();
    console.log(red('failed'));
    console.log(dim('  ' + msg.split('\n').slice(-2).join('\n  ')));
    if (/ENOTFOUND|Tenant or user not found/i.test(msg)) {
      console.log(
        '\n' + dim('Check the username — the pooler needs postgres.PROJECT_REF, not postgres.')
      );
    } else if (/could not translate host|Network is unreachable|ETIMEDOUT/i.test(msg)) {
      console.log(
        '\n' + dim('Looks like the IPv6-only direct host. Use the Session pooler instead.')
      );
    } else if (/password authentication/i.test(msg)) {
      console.log('\n' + dim('Wrong password. Settings → General has a reset.'));
    }
    console.log(dim('\nSaving anyway so you can correct it by hand.'));
  }
}

// --- write ------------------------------------------------------------
/*
 * UTF-8, LF, no BOM — written by Node rather than by the shell, which is
 * the entire point of this script on Windows.
 */
const ORDER = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'NEXT_PUBLIC_SITE_URL',
];
const keys = [...ORDER.filter((k) => env[k]), ...Object.keys(env).filter((k) => !ORDER.includes(k))];

writeFileSync(
  ENV,
  '# Written by database/scripts/setup.mjs. Gitignored — keep it that way.\n\n' +
    keys.map((k) => `${k}=${env[k]}`).join('\n') +
    '\n',
  { encoding: 'utf8' }
);

console.log('\n' + green('Saved') + ' ' + dim(ENV));
console.log(dim(`  ${keys.length} value(s), UTF-8`));
console.log('\nNext, and it changes nothing:\n');
console.log('  npm run db:remote\n');
