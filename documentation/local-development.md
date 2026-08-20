# Local development

Two modes. Start with the first — most work does not need a database.

---

## 1. Offline (no database)

```bash
npm install
npm run dev
```

Public pages render from the fallback content in `apps/web/lib/content.ts`,
which mirrors `database/seed/0001_house.sql` exactly. Good for design,
layout, copy, and component work.

What does **not** work offline: sign-in, the admin surface (it says so
plainly rather than pretending), and anything that writes.

---

## 2. Against a real Supabase project

### Create the project

1. Create a Supabase project **under the Soulfables organisation**, not a
   personal account. See §11 of the architecture document — this is the
   single most common way a project quietly becomes un-transferable.
2. Choose the region closest to most readers.
3. Note the project URL and both keys from *Project settings → API*.

### Enable pgvector

The schema uses `vector(1536)` on `stories` for the Intelligence layer.
In *Database → Extensions*, enable `vector`. Migration `0001` also tries
to create it, which works if your role has permission.

### Apply the migrations

In order. They are forward-only and numbered for a reason — `0004`
references tables from `0003`, and `0011` attaches policies to everything
before it.

Via the SQL editor: paste each file from `database/migrations/` in
ascending order, running each fully before the next.

Via the CLI:

```bash
supabase link --project-ref <your-ref>
for f in database/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

Then the seed:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed/0001_house.sql
```

The seed is idempotent — every insert is guarded on its natural key, so
re-running is safe and CI proves it.

### Configure the app

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The service role key bypasses RLS entirely. It has no `NEXT_PUBLIC_`
prefix, so Next refuses to inline it into a client bundle. Never move it
into one.

### Make yourself staff

New accounts get the `reader` role from the `handle_new_user()` trigger.
Sign up through the app first, then in the SQL editor:

```sql
update user_roles
   set role = 'owner'
 where user_id = (select id from auth.users where email = 'you@example.com');
```

`/admin` is now reachable. Non-staff visitors get a 404 rather than a
"forbidden" — the House does not confirm that `/admin` exists to someone
who has no business there.

---

## Verifying the security posture

Worth doing once by hand, and again before any launch. This is milestone
M4 in the architecture document.

**Journal privacy.** Sign in as an owner and try to read another reader's
entries:

```sql
-- As an authenticated non-owner session, this must return zero rows
-- even for a user with role = 'owner'.
select * from journal_entries where user_id <> auth.uid();
```

**Entitlements.** No client role may write them:

```sql
-- Must fail with a policy violation.
insert into entitlements (user_id, product_id, source)
values (auth.uid(), '<some product id>', 'purchase');
```

**RLS coverage.** Run the same check CI runs:

```bash
psql "$DATABASE_URL" -f database/checks/rls_coverage.sql
```

It fails loudly if any table has RLS off, or has RLS on with no policy
and is not on the documented service-role-only list.

---

## Common problems

**`vector` type does not exist** — enable the extension before running
`0001`, or run `0001` with a role that can create extensions.

**Auth emails never arrive** — Supabase's built-in SMTP is heavily rate
limited and often lands in spam. For real testing configure a proper
provider under *Authentication → Email templates → SMTP*.

**`/admin` redirects to sign-in in a loop** — the account has no row in
`user_roles`, usually because it was created before the trigger existed.
Insert one manually.

**Story slug conflicts on save** — slugs are globally unique. The editor
reports this as "Another story already uses that web address" rather than
a database error.

**Build fails on a `Route` type** — `typedRoutes` is on, so `href` values
must be known routes. A dynamic path needs the route file to exist first.
