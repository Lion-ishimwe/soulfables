# Running against a real PostgreSQL

Two ways to exercise the schema, and they answer different questions.

| | Needs | Proves |
|---|---|---|
| `npm run db:test` | nothing | The SQL is valid and applies in order. Runs in CI. |
| `npm run db:local` | PostgreSQL | The same, **plus** that RLS actually denies. |

The second one matters more than it sounds. `db:test` uses PGlite, which
has no roles, so every query runs as the owner and RLS is never
exercised. Only a real server can run a query *as a reader* and watch the
database refuse.

## Install

PostgreSQL 17, no admin rights needed on Windows:

```bash
scoop install postgresql
```

Start it (the data directory is created by the installer):

```bash
pg_ctl -D "$HOME/scoop/apps/postgresql/current/data" -l "$HOME/scoop/apps/postgresql/current/pg.log" start
```

macOS is `brew install postgresql@17 && brew services start postgresql@17`;
Linux is your package manager plus `systemctl start postgresql`.

## Run it

```bash
npm run db:local
```

That drops and recreates a scratch database called `soulfables`, applies
the shim, every migration, the seed twice, and both RLS checks. It
refuses to run against a database whose name contains `prod`, `live` or
`main`.

If `psql` is not found, the script looks in the usual install locations
before giving up — a freshly installed Postgres updates the user PATH,
but a terminal that was already open keeps the old one. Set `PGBIN` to
override.

## What the shim is

`database/shim/supabase-local.sql` stands up what a hosted Supabase
project provides and a bare server does not: the `auth` and `storage`
schemas, the three API roles, and `auth.uid()`.

It is **not** a Supabase emulator. There is no PostgREST, no GoTrue, no
Storage API — so the application still cannot talk to this database. What
it gives is the schema and the security model, which is what needed
proving.

It also adds `auth.become(uuid)` and `auth.become_anonymous()`, which is
how the enforcement test signs in as a particular reader.

## What the RLS test asserts

`database/checks/rls_enforcement.sql`, run as `authenticated` rather than
as the superuser — a superuser bypasses RLS, so the same test run as
`postgres` would pass while proving nothing.

- A reader sees only their own journal entries
- A reader cannot read another reader's journal
- A reader cannot see what somebody else has bought
- A reader who has not bought a product is not entitled to it
- A reader cannot grant themselves an entitlement
- A reader cannot create an order at all
- **Staff cannot read any journal entry**
- An anonymous visitor sees no journal entries, entitlements or paid files
- An anonymous visitor can still read published stories

That last pair is the shape of the whole security model: everything
private is denied by default, and the public library stays public.

## No pgvector

`scoop`'s PostgreSQL does not ship pgvector, and the schema copes —
migration 0004 creates `stories.embedding` only where the extension
exists. That conditional is exercised every time this script runs.
