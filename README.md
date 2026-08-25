# Soulfables

> Every Soul Has a Story.

A cinematic storytelling and digital publishing platform: a library of
modern folktales arranged by feeling, a distraction-free reader, a private
journal, and a bookshop that reliably puts purchased files in a customer's
hands.

**Read [`documentation/architecture.html`](documentation/architecture.html)
before changing anything structural.** It explains why the schema is shaped
the way it is, and records two decisions that are still open.

---

## Try it

```bash
npm install
npm run demo
```

That builds once and serves the production bundle. Use it for anything
you are showing someone.

`npm run dev` is for editing code, not for judging speed — it compiles
each route the first time you visit it, so pages take hundreds of
milliseconds that the built app does not. Measured on the production
build, every route responds in **3–30 ms**.

Open http://localhost:3000 and sign in at `/signin`. There are no
passwords — pick one of three people and the House changes around you:

| | Who | What they get |
|---|---|---|
| **Apophia** | Owner | The whole admin: submissions, stories, shelves, products, orders, readers, analytics. Plus a writing room. |
| **Seren Adair** | Author | A studio, the story template, and the ability to submit — but **not** to publish. No admin at all. |
| **Amara** | Reader | The library, a private journal, saved stories and her own shelf. No studio, no admin. |

Any other address comes in as a reader, which is what a real new account
is — roles are granted deliberately, never assumed.

Everything runs without a database. What is real and what is standing in
is listed at `/about-this-demo`, and a banner says so on every page.

| Capability | Where | State |
|---|---|---|
| Discover | `/`, `/library`, `/shelf/…`, `/search`, `/wander` | Working |
| Read | `/story/…` | Working |
| Listen | narrated stories | Player real, track is a placeholder tone |
| Save · bookmark · highlight | in the reader | Working |
| Journal | `/journal` | Working |
| Personal library | `/account/library` | Working |
| Recommendations | `/` | Working, each with its reason |
| AI companion | `/companion` | Real safety layer, scripted replies |
| Subscriptions | `/membership` | Switch tiers to lock/unlock the paywall |
| Community | `/residents` | Deliberately thin — concept undecided |
| Purchase | `/shop` | **Not connected** — the last milestone |
| Admin | `/admin` | Browsable; writing needs the database |

## Status

Phase 1 (Foundation) and the demo of the full ecosystem are done.
Payments are deliberately last.

| Area | State |
|---|---|
| Database schema, RLS, storage buckets | Written, verified against real Postgres (`npm run db:test`) |
| Design system | Tokens measured from the live site |
| Public site | All surfaces rendering |
| Authentication | Sign in, join, reset, callback, guest-order claim |
| Admin | Every section built; writes need the database |
| Checkout and webhook | Written and typed; never run against a real provider |
| Digital delivery | Written; needs private storage to exercise |

Decisions D1 (Stripe, pending country confirmation) and D2 (clean start,
admin grants access by hand) are settled — see the architecture document.

---

## Two modes

The app decides for itself. With Supabase credentials it reads and writes
Postgres, RLS applies, and auth is real. Without them it runs on sample
content and an in-process store that resets when the server restarts.

Same pages, same components, same server actions in both — there is no
demo fork to keep in sync, and nothing to unpick when the database
arrives. `NEXT_PUBLIC_DEMO_MODE=true` forces demo mode even where
credentials exist, which is what a public showcase should set.

To run against a real database, see
[`documentation/local-development.md`](documentation/local-development.md).

---

## Layout

```
apps/
  web/              Next.js — public site and the /admin route group
packages/
  design-system/    Tokens. The single source of truth for colour and type.
  models/           Types generated from the schema
  shared/           Validation, formatting, constants
services/
  ai/               Companion and embeddings (Phase 6)
database/
  migrations/       13 numbered SQL files, forward-only
  seed/             The House as it stands today
  checks/           RLS coverage check, run in CI
  test/             Applies the whole schema to real Postgres in-process
documentation/
```

Admin ships inside `apps/web` rather than as a separate app: one
deployment, one auth session, one RLS surface. This is a deliberate
deviation from the brief, explained in §02 of the architecture document.

---

## The rules that matter

Three invariants. Breaking any of them is a security bug, not a style
disagreement.

**1. Entitlements are the only source of file access.**
Access is never derived from an order, a session, a redirect, or anything
the browser said — only from a row in `entitlements`, written by a
signature-verified webhook. `paid_at` is writable by the webhook handler
and nothing else.

**2. The service role never reaches a browser.**
`lib/supabase/admin.ts` bypasses RLS entirely and exists for four jobs
only: webhook handling, minting signed download URLs, scheduled jobs, and
audited admin actions. It imports `server-only`, so using it in a client
component is a build error rather than a leaked key.

**3. Journal entries are private from staff too.**
No RLS policy grants staff read access to `journal_entries`, and none
should be added. An administrator can see that a reader has fourteen
entries, never what any of them says.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the web app |
| `npm run build` | Production build |
| `npm run typecheck` | Typecheck every workspace |
| `npm run db:test` | Apply every migration to a real Postgres and check RLS |

CI runs typecheck and build, applies all migrations to a clean Postgres,
applies the seed twice to prove it is idempotent, and fails if any table
has RLS disabled or has RLS on with no policy and no documented reason.

---

## Ownership

Per §26 of the brief and §11 of the architecture document: the GitHub
organisation, Supabase project, domain, payment account, email sending
account and every other production credential belong to Soulfables.
Developers receive access; they do not hold the accounts.

No production secret should exist solely on a developer's machine.
