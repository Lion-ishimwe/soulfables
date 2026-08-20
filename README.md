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

## Status

Phase 1 (Foundation) is in progress. Phases 2 and 3 are blocked on
decisions D1 and D2 in the architecture document.

| Area | State |
|---|---|
| Database schema, RLS, storage buckets | Written, applied in CI |
| Design system | Tokens measured from the live site |
| Public site — home, library, shelves, reader, shop | Rendering |
| Authentication | Sign in, join, reset, callback, guest-order claim |
| Admin — story authoring | Working end to end |
| Admin — shelves, products, orders, users | Scaffolded, not built |
| Checkout and delivery | **Blocked on D1** (payment provider) |
| Content migration from Base44 | **Blocked on D2** (what carries over) |

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in, or leave blank to work offline
npm run dev
```

The site runs at `http://localhost:3000` **without a database**. Public
pages fall back to the content in `apps/web/lib/content.ts`, which mirrors
`database/seed/0001_house.sql` exactly, so design and layout work needs no
Supabase project. The admin surface says plainly that it is not connected
rather than showing an empty table that looks like real data.

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
  migrations/       12 numbered SQL files, forward-only
  seed/             The House as it stands today
  checks/           RLS coverage check, run in CI
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
