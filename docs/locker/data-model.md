# The Locker — Data Model Plan

*Drafted 2026-06-11. Names negotiable; shapes follow existing house patterns
(JSONB like `schools.schedules`, numbered migrations, Zod mirroring Postgres
constraints, RLS as the real boundary).*

## Identity spine (the one new concept)

Students have no accounts today — they're roster rows, and the same kid can
exist on multiple teachers' rosters. **Decision 2026-06-12: unify identity
school-wide first.** A school-level student identity merges duplicate roster
rows; the locker, wallet, and combo claim hang off the unified identity (a
merge map table `student_links(canonical_student_id, roster_student_id)` or
a `canonical_id` column on students — design in Phase 1). Access is
DailyWins-native (combo claim + durable device cookie via the magic-link
machinery); the LTI columns below are dropped from v1 and return as an
adapter when a Canvas district appears:

### `student_identities`
| column | type | constraint |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| student_id | uuid NOT NULL → students(id) | **UNIQUE** — the CANONICAL (unified) student row |
| combo | text NOT NULL | the 3-number slip, e.g. '24-08-31'; generated with the roster |
| claimed_at | timestamptz | NULL until the first combo claim |
| device_count | int NOT NULL default 0 | bookkeeping; each claim issues a durable signed cookie |
| (future) lti_issuer/lti_subject | text | added by the LTI adapter migration when a Canvas district appears |
| created_at | timestamptz NOT NULL default now() | |

Combo flow: teacher prints slips → student opens the class locker link →
enters combo → claim binds a durable signed httpOnly cookie on that device to
the canonical student. New device/cleared cookies → spin the combo again.
Teacher can regenerate a combo (invalidates old slips).

**FERPA note:** no student email, no external identity, no PII beyond what
the roster already holds; the cookie carries an opaque claim id only.

### `points_ledger` (append-only — the bank)
| column | type | constraint |
|---|---|---|
| id | uuid PK | |
| student_id | uuid NOT NULL → students(id) | indexed (student_id, created_at desc) |
| entry_type | text NOT NULL | CHECK in ('earn','spend','adjustment','refund') |
| amount | integer NOT NULL | CHECK (amount <> 0); sign convention: earn/refund > 0, spend < 0, adjustment either |
| ref | jsonb NOT NULL default '{}' | e.g. {kind:'daily_earn', date:'2026-06-11'} / {kind:'purchase', item_id:'stk-boombox', catalog_version:3} / {kind:'adjustment', reason:'...'} |
| created_by | uuid → auth.users(id) | NULL for system rows (daily earn job) |
| created_at | timestamptz NOT NULL default now() | |

- **Immutability enforced in the DB**, not convention: RLS with no UPDATE/
  DELETE policies for any role, plus a `BEFORE UPDATE OR DELETE` trigger that
  raises — service-role included. Corrections are new `adjustment`/`refund`
  rows. (Same instinct as the audit log, one notch harder.)
- Balance = `sum(amount)` per student; a partial unique index is unnecessary —
  derive, never store. A `student_wallets` materialized view (or computed
  RPC) keeps reads cheap; refresh on write or compute on demand (v1: RPC sum;
  trivial at classroom scale).
- One UNIQUE guard against double-crediting the daily earn:
  `UNIQUE (student_id, (ref->>'kind'), (ref->>'date')) WHERE ref->>'kind' = 'daily_earn'`.
- **Spending never touches `behavior_scores`.** Different table, different
  direction, no foreign key into the behavior record beyond the ref payload.

### `student_inventory`
| column | type | constraint |
|---|---|---|
| id | uuid PK | |
| student_id | uuid NOT NULL → students(id) | UNIQUE(student_id, item_id) |
| item_id | text NOT NULL | validated against catalog at write time (catalog is JSON, not a table — see below) |
| acquired_via | text NOT NULL | CHECK in ('starter','purchase','grant') |
| ledger_id | uuid → points_ledger(id) | NOT NULL when acquired_via='purchase' |
| acquired_at | timestamptz NOT NULL default now() | |

### `locker_layouts`
| column | type | constraint |
|---|---|---|
| student_id | uuid PK → students(id) | one locker per student |
| layout | jsonb NOT NULL default '{"items":[],"background":null}' | shape below |
| updated_at | timestamptz NOT NULL default now() | |

Layout JSONB (mirrors the schedules-in-JSONB house pattern):
```json
{
  "background": "bg-navy-paint",
  "items": [
    { "item_id": "stk-boombox", "x": 0.42, "y": 0.18, "z": 3, "rot": -12 }
  ]
}
```
x/y normalized 0–1; z integer; rot degrees clamped ±45. Server validates with
Zod **and** a CHECK on `jsonb_array_length(layout->'items') <= 30`; every
placed `item_id` must exist in the student's inventory (validated in the save
route — cheap at n≤30).

## Catalog: JSON file, not a table (decision already made)

`docs/locker/catalog-v1.json` ships in the repo; the app imports it. Purchases
record `catalog_version` + price paid in the ledger ref, so price changes
never rewrite history. No student data in the catalog; no PII anywhere in
locker tables (item ids + coordinates only).

## RLS posture

LTI sessions are **not** Supabase Auth sessions. All student reads/writes go
through server routes that (a) verify the LTI session cookie (signed, httpOnly,
issued after token validation), (b) resolve `student_id` via
`student_identities`, and (c) use the service-role client scoped by that id.
Therefore:

- All four tables: RLS **enabled, zero anon/authenticated policies** — browser
  credentials see nothing, ever.
- Teachers read `points_ledger` (their students) and write `adjustment`/
  `refund` via existing authenticated server routes (teacher RLS reuse:
  `school_id in (select ... where auth_id = effective_user_id())` on a
  read-only view if direct reads are wanted later).
- `student_identities.combo` is never sent to a browser after claim.

## Zod ↔ Postgres mirror table

| Constraint | Postgres | Zod |
|---|---|---|
| entry_type | CHECK in (…) | z.enum([...]) |
| amount ≠ 0, int | CHECK + integer | z.number().int().refine(v => v !== 0) |
| layout items ≤ 30 | CHECK jsonb_array_length | z.array(...).max(30) |
| x,y ∈ [0,1], rot ∈ [-45,45] | (Zod-only; jsonb) | z.number().min(0).max(1) etc. |
| item ownership | save-route check | (runtime, not schema) |

Migrations: next numbers in sequence (053+), one concern per file, snapshot
before prod apply, per house rules.
