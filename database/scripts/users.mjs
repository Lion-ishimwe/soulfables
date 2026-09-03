/**
 * Create real accounts, with real passwords, in Supabase Auth.
 *
 * Demo mode let any well-formed email through because there was no
 * database to check against. There is one now, so identity comes from
 * auth.users and a password, like everywhere else.
 *
 * Nothing here invents a schema: inserting into auth.users fires the
 * on_auth_user_created trigger, which creates the profile, the settings
 * row, and a 'reader' role. This script creates the account and then
 * elevates the role where it should be higher — it never writes a
 * profile by hand, because the trigger is the thing that has to keep
 * working when somebody signs up through the front door.
 *
 *   node database/scripts/users.mjs                      # show what exists
 *   node database/scripts/users.mjs --create             # create the missing ones
 *   node database/scripts/users.mjs --reset-password EMAIL
 *
 * Passwords are generated here and printed ONCE. They are never written
 * to a file, because a file is a thing that gets committed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { normalise } from './connection.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

// --- environment ------------------------------------------------------
const envFile = join(REPO, '.env.local');
if (!existsSync(envFile)) {
  console.error('\n' + red('No .env.local.') + ' Run npm run db:setup first.\n');
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);

const API = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const DB = env.SUPABASE_DB_URL ? normalise(env.SUPABASE_DB_URL).url : null;

for (const [name, value] of [
  ['NEXT_PUBLIC_SUPABASE_URL', API],
  ['SUPABASE_SERVICE_ROLE_KEY', SERVICE],
  ['SUPABASE_DB_URL', DB],
]) {
  if (!value) {
    console.error('\n' + red(`${name} is missing from .env.local.`) + '\n');
    process.exit(1);
  }
}

function findPsql() {
  if (process.env.PGBIN) return join(process.env.PGBIN, 'psql');
  const candidates = [
    join(homedir(), 'scoop', 'apps', 'postgresql', 'current', 'bin', 'psql.exe'),
    join('C:', 'Program Files', 'PostgreSQL', '17', 'bin', 'psql.exe'),
    '/usr/bin/psql',
    '/usr/local/bin/psql',
    '/opt/homebrew/bin/psql',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return 'psql';
}
const PSQL = findPsql();
const sql = (q) =>
  execFileSync(PSQL, [DB, '-v', 'ON_ERROR_STOP=1', '-tAc', q], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 40000,
  }).trim();

// --- the accounts -----------------------------------------------------
/*
 * Three roles, because the whole editorial workflow needs three to be
 * visible at once: someone who publishes, someone who writes and cannot
 * publish, and someone who only reads. One account cannot demonstrate a
 * permission boundary.
 *
 * The owner defaults to the address this project belongs to, so password
 * reset reaches a mailbox that exists. Override with --owner.
 *
 * Changed from info@rightseat.rw on 3 September 2026. The live account
 * was moved with the admin API rather than recreated, so it kept its id,
 * its owner role, its authors row and every audit entry attributed to it;
 * this default only matters if the accounts are ever seeded afresh.
 */
const ownerFlag = process.argv.indexOf('--owner');
const OWNER_EMAIL =
  ownerFlag !== -1 && process.argv[ownerFlag + 1]
    ? process.argv[ownerFlag + 1]
    : 'soulfableslib@gmail.com';

const ACCOUNTS = [
  {
    email: OWNER_EMAIL,
    displayName: 'Apophia',
    role: 'owner',
    authorSlug: 'apophia-kamwine',
    note: 'Runs the House. Sees the admin, publishes, grants access.',
  },
  {
    email: 'seren@soulfables.co',
    displayName: 'Seren Adair',
    role: 'author',
    authorSlug: 'seren-adair',
    note: 'Writes and submits. Cannot publish — that is the point.',
  },
  {
    email: 'reader@soulfables.co',
    displayName: 'Amara',
    role: 'reader',
    authorSlug: null,
    note: 'Reads, saves, journals. Sees none of the above.',
  },
];

/**
 * Readable but not guessable. Length does the work — these are meant to
 * be pasted from a password manager, then changed.
 */
function generatePassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(24);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function admin(path, init = {}) {
  const res = await fetch(`${API}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(body.msg ?? body.message ?? body.error_description ?? `${res.status} ${text.slice(0, 200)}`);
  }
  return body;
}

/**
 * Can this key actually act as an administrator?
 *
 * Checked rather than assumed, because the failure is a 403 several
 * steps later that says "User not allowed" — which sounds like a problem
 * with the account being created rather than with the key doing the
 * creating.
 */
async function adminKeyWorks() {
  try {
    await admin('/users?per_page=1');
    return true;
  } catch {
    return false;
  }
}

/*
 * Creating a user without the Admin API.
 *
 * The supported path is the Admin API and it is preferred whenever the
 * key allows it. This exists because a service_role key is easy to get
 * wrong — pasting the anon key into both slots produces a key that reads
 * fine and cannot administer anything — and because the database is
 * right there.
 *
 * GoTrue needs two rows, not one: auth.users, and an auth.identities row
 * recording that this user has an email identity. Without the second,
 * the account exists and cannot sign in, which is a confusing state to
 * debug.
 */
function createUserViaSql(email, password, displayName) {
  const id = sql('select gen_random_uuid()');
  const esc = (v) => v.replace(/'/g, "''");

  /*
   * The empty strings are not decoration.
   *
   * GoTrue reads confirmation_token and its siblings into Go strings,
   * and a NULL there is not a string — so sign-in fails with a 500 and
   * "Database error querying schema", which says nothing about tokens
   * and sounds like the schema is broken. It is not: those columns just
   * have to be '' rather than NULL. The Admin API sets them; hand-written
   * SQL has to remember to.
   */
  sql(`insert into auth.users (
         id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new,
         email_change, email_change_token_current, reauthentication_token,
         phone_change, phone_change_token
       ) values (
         '${id}',
         '00000000-0000-0000-0000-000000000000',
         'authenticated', 'authenticated',
         '${esc(email)}',
         crypt('${esc(password)}', gen_salt('bf')),
         now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('display_name', '${esc(displayName)}'),
         now(), now(),
         '', '', '', '', '', '', '', ''
       )`);

  sql(`insert into auth.identities (
         id, provider_id, user_id, identity_data, provider,
         last_sign_in_at, created_at, updated_at
       ) values (
         gen_random_uuid(), '${id}', '${id}',
         jsonb_build_object('sub', '${id}', 'email', '${esc(email)}', 'email_verified', true),
         'email', now(), now(), now()
       )`);

  return { id };
}

/** Proof, not assumption: sign in the way the app would. */
async function canSignIn(email, password) {
  const res = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

async function existingUsers() {
  const out = new Map();
  // One page is plenty here, and asking for more would be pretending
  // this script is something it is not.
  try {
    const body = await admin('/users?per_page=200');
    for (const u of body.users ?? []) out.set((u.email ?? '').toLowerCase(), u);
  } catch {
    // No admin key. The database answers the same question.
    const rows = sql('select id || $$ $$ || coalesce(email, $$$$) from auth.users');
    for (const line of rows.split(String.fromCharCode(10))) {
      if (!line.trim()) continue;
      const [id, mail] = line.trim().split(' ');
      if (mail) out.set(mail.toLowerCase(), { id, email: mail });
    }
  }
  return out;
}

// --- run --------------------------------------------------------------
console.log('\n' + bold('Soulfables — accounts') + '\n');

const found = await existingUsers();

const resetFlag = process.argv.indexOf('--reset-password');
if (resetFlag !== -1) {
  const email = (process.argv[resetFlag + 1] ?? '').toLowerCase();
  const user = found.get(email);
  if (!user) {
    console.error(red(`No account for ${email}.`) + '\n');
    process.exit(1);
  }
  const password = generatePassword();

  if (await adminKeyWorks()) {
    await admin(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  } else {
    sql(
      `update auth.users
          set encrypted_password = crypt('${password.replace(/'/g, "''")}', gen_salt('bf')),
              updated_at = now()
        where id = '${user.id}'`
    );
  }

  if (!(await canSignIn(email, password))) {
    console.error(red('Reset did not take - the old password still works.'));
    process.exit(1);
  }

  console.log(`  ${green('reset')} ${email} ${dim('(sign-in verified)')}`);
  console.log(`  ${bold(password)}`);
  console.log('\n' + dim('Shown once. Save it now.') + '\n');
  process.exit(0);
}

const CREATE = process.argv.includes('--create');

if (!CREATE) {
  for (const a of ACCOUNTS) {
    const u = found.get(a.email.toLowerCase());
    const role = u ? sql(`select role from user_roles where user_id = '${u.id}'`) || '(none)' : '';
    console.log(`  ${u ? green('exists') : dim('missing')}  ${a.email.padEnd(28)} ${u ? role : a.role}`);
  }
  console.log('\n' + dim(`${found.size} account(s) in auth.users.`));
  console.log('\nTo create the missing ones:\n');
  console.log('  node database/scripts/users.mjs --create\n');
  process.exit(0);
}

/*
 * Prefer the supported path. Fall back only when the key cannot do the
 * job, and say which one was used — silently taking a different route
 * hides a misconfiguration the user should know about.
 */
const USE_ADMIN = await adminKeyWorks();
console.log(
  USE_ADMIN
    ? dim('  using the Admin API')
    : dim('  service_role key cannot administer — creating directly in the database')
);
console.log('');

const created = [];
for (const a of ACCOUNTS) {
  const existing = found.get(a.email.toLowerCase());
  if (existing) {
    console.log(`  ${dim('exists')} ${a.email}`);
    continue;
  }

  const password = generatePassword();

  /*
   * email_confirm skips the verification email. These addresses are
   * created deliberately by the owner of the project, and two of them
   * are not real mailboxes — waiting for a click that can never arrive
   * would leave the accounts unusable.
   */
  let user;
  if (USE_ADMIN) {
    user = await admin('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: a.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: a.displayName },
      }),
    });
  } else {
    user = createUserViaSql(a.email, password, a.displayName);
  }

  /*
   * Verify by signing in, not by trusting the insert.
   *
   * The SQL path writes rows GoTrue did not write, so the only honest
   * check is whether GoTrue will now accept the password — which is
   * exactly what the application will ask it.
   */
  const works = await canSignIn(a.email, password);
  if (!works) {
    console.log(`  ${red('FAILED')} ${a.email} — created but cannot sign in`);
    sql(`delete from auth.users where id = '${user.id}'`);
    console.log(dim('  rolled back, so it does not sit there half-made'));
    continue;
  }

  console.log(`  ${green('created')} ${a.email} ${dim('(sign-in verified)')}`);
  created.push({ ...a, password });

  // The trigger has already made this a reader. Only say otherwise when
  // it is otherwise.
  if (a.role !== 'reader') {
    sql(
      `insert into user_roles (user_id, role) values ('${user.id}', '${a.role}')
       on conflict (user_id) do update set role = excluded.role`
    );
  }

  // Give the author account its byline, so what they write appears
  // under the right name rather than as an orphan.
  if (a.authorSlug) {
    sql(`update authors set user_id = '${user.id}' where slug = '${a.authorSlug}'`);
  }
}

if (!created.length) {
  console.log('\n' + dim('Nothing to create.') + '\n');
  process.exit(0);
}

console.log('\n' + bold('Passwords — shown once, never written to disk') + '\n');
for (const c of created) {
  console.log(`  ${bold(c.email)}`);
  console.log(`  ${c.role.padEnd(8)} ${c.password}`);
  console.log(dim(`  ${c.note}`));
  console.log('');
}
console.log(dim('Change them at /account/password once you are in.'));
console.log(dim('Lost one? node database/scripts/users.mjs --reset-password EMAIL') + '\n');
