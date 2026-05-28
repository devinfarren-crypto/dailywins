**DailyWins Act-As — Design Doc v1**

Author: Devin Farren (with Claude pairing)

Date: May 28, 2026

Status: Design landed; implementation pending review.

Companion to: `TIERED_ARCHITECTURE_v1.1.md` (Phase 5)

# Why this doc exists

The four-tier model (Founder, District Admin, Site Admin, Teacher) is structurally PII-blind for everyone above Teacher. That's the right default for FERPA defensibility — non-Teacher roles should never see student behavior data by accident.

But it leaves a real gap: when a teacher is stuck, when a parent disputes a note, when a site admin needs to verify what a teacher actually scored, somebody has to be able to see what the teacher sees. The answer is act-as — the only formally controlled path by which non-Teacher roles ever see student PII. Every act-as session is audit-logged. Teachers can review who acted as them.

This is also the EGUSD July 13 demo's closer: *"Approve-gated onboarding plus audit-logged break-glass access is how we take FERPA seriously."*

# The design

## Who can act-as whom

| Actor | Can act-as | Notes |
|---|---|---|
| Founder (regular) | Any Teacher | Standard path |
| Founder (break-glass) | Any role (D-A, S-A, Founder) | Requires reason + 15-min hard timeout |
| District Admin | Teachers in their district | Scoped via `role_assignments.district_id` |
| Site Admin | Teachers at their school | Scoped via `role_assignments.school_id` |
| Teacher | Nobody | — |

Targets outside an actor's scope are not visible in the picker and rejected by RLS. The "Founder break-glass" path is the only path that reaches non-Teacher roles, by design.

## Identity model: dual identity

The actor stays signed in throughout. The server holds both identities; RLS resolves data queries as the target so the actor sees what the target sees.

- A new `act_as_sessions` row is created when act-as starts. It carries `actor_user_id` (the founder/admin), `target_user_id` (the teacher), `started_at`, `ended_at` (nullable), `break_glass` flag, `reason` (nullable, required when `break_glass=true`), and an `expires_at` driven by the lifecycle rules below.
- A SQL function `effective_user_id()` checks `act_as_sessions` for an open row keyed by `auth.uid()` and returns the target's id if one exists, otherwise returns `auth.uid()`.
- RLS policies that gate **PII access** (behavior_scores, notes, students-as-seen-by-a-teacher) are migrated to use `effective_user_id()` instead of `auth.uid()`.
- RLS policies that **audit-stamp the actor** (`role_assignments.created_by`, `access_requests.reviewed_by`, etc.) continue to use `auth.uid()`. The actor is the real-world doer; the target is the data lens.

This split — `effective_user_id()` for data access, `auth.uid()` for attribution — is the core architectural commitment.

## Audit log

The `audit_log` table is built as the foundation for Phase 4, not as an act-as-only artifact. Schema:

```sql
audit_log (
  id              uuid pk
  actor_user_id   uuid not null
  acting_as_user_id uuid nullable     -- present when the row was written during act-as
  action          text not null       -- 'act_as.start', 'act_as.end', 'score.save', etc.
  target_table    text nullable
  target_id       uuid nullable
  before          jsonb nullable
  after           jsonb nullable
  reason          text nullable
  break_glass     boolean default false
  created_at      timestamptz default now()
)
```

Wired into:
- Act-as session start (action `act_as.start`) and end (action `act_as.end`), with reason + break_glass populated.
- Every INSERT/UPDATE/DELETE the actor performs while act-as'd, written by the app code that already owns each write path.
- Later phases extend coverage to admin actions (approve/deny requests, role changes, school edits) outside of act-as too. Same table.

### Audit visibility

| Reader | Sees |
|---|---|
| Founder | Everything |
| Acting-as target (teacher) | Rows where `acting_as_user_id = self.user_id` (the "who acted as me" view) |
| Actor (anyone) | Rows where `actor_user_id = self.user_id` (the "what did I do" view) |
| Everyone else | Nothing |

Teachers can find the "who acted as me" view from a self-service settings link. No push notification.

## Session lifecycle

| Session type | Exit | Timeout |
|---|---|---|
| Regular act-as | Manual ("Exit act-as" button) | 60 min of inactivity |
| Founder break-glass | Manual or auto | 15 min absolute hard cap from start |

Server checks `expires_at` on every act-as'd request; if past, the session is treated as ended and the actor is bumped back to their own identity. Inactivity is updated on each request.

## Concurrency

- One actor per target at any time. Enforced by a unique partial index: `act_as_sessions(target_user_id) WHERE ended_at IS NULL`.
- One open session per actor. Enforced by: `act_as_sessions(actor_user_id) WHERE ended_at IS NULL`.
- Target's own session is independent and unaffected. Two parallel writers (target + actor) becomes a normal last-write-wins concern, same as two browser tabs.

## District scope

`schools.district` is currently free-text. To make D-A scope queries reliable:

1. New `districts` table: `id, name UNIQUE, state nullable, created_at`.
2. `schools.district_id` (FK to `districts.id`).
3. Backfill: insert distinct `schools.district` values into `districts`; populate `schools.district_id`.
4. `role_assignments` gains nullable `district_id` for D-A assignments. A D-A's reach is "every Teacher with a `role_assignments.role='teacher'` row at a school whose `district_id` matches the D-A's `district_id`."

Drop `schools.district` text column in a later migration once nothing reads it.

## UI surfaces (Phase 5, separate doc)

Out of scope for this doc but cited so the contract is visible:
- Teacher picker page (scoped to actor's reach).
- Top-of-page "You are acting as X — Exit" banner everywhere during act-as.
- Audit-log view (per-teacher self-serve + global founder view).
- Break-glass confirmation modal (reason field, 15-min explicit warning).

# Build sequence

1. **Migration 027 — schema foundation** (this doc's companion file). `districts`, `schools.district_id`, `audit_log`, `act_as_sessions`, `effective_user_id()`, indexes, RLS on the new tables. Backfills `districts` from existing `schools.district` text. No RLS changes to existing tables.
2. **Migration 028 — RLS rewrite.** Migrate PII-access RLS policies on `behavior_scores`, `notes`, `students` (teacher-scoped view) to use `effective_user_id()`. Keep `auth.uid()` everywhere else. This is the highest-risk migration — applied to staging first, tested, then prod.
3. **Server routes** — `POST /api/admin/act-as/start`, `POST /api/admin/act-as/end`, `POST /api/admin/break-glass/start`. Founder-gated for break-glass; tier-scoped for regular. Audit-log writes baked in.
4. **UI** — teacher picker, in-session banner, audit-log views.
5. **Wire audit-log writes into existing write paths.** Score save, note CRUD, role assignment changes, approve/deny request, school edits. One call per write site.

# Open questions for v1.5

These don't block v1 but should be on the list:

- **Audit retention** — TIERED_ARCHITECTURE_v1.1 already flags this as TBD pending EGUSD CTO input. Confirm before launch.
- **Audit log volume** — at scale, behavior_scores writes alone could fill the log fast. Partition by month? Move cold rows to cold storage? Decide once we have real volume.
- **Postgres triggers vs app-layer writes** — v1 wires audit writes from app code, which is faster to ship but easier to forget. v1.5 may move to triggers on tracked tables so coverage is guaranteed.
- **Step-up auth for break-glass** — v1 uses a reason field. A future v1.5 could add Google re-auth before break-glass starts.
- **Notification to a security inbox on break-glass** — currently silent except for the audit log. Configurable email destination is a one-evening addition.
- **Multi-tab act-as** — what happens if the actor opens act-as in two tabs? Both query the same session and get the same RLS view, so likely fine, but worth verifying.
- **What an act-as'd actor cannot do** — should we block certain actions inside an act-as session even with full read+write? E.g., changing the target's own role assignments while pretending to be them. Probably yes; gate via app-layer check.

# Decisions log

| Question | Decision | Rationale |
|---|---|---|
| Who can act-as whom | Only Teacher targets; Founder break-glass for any role | PII access flows downward; break-glass is the named exception |
| Identity model | Dual identity (actor stays, target seen via `effective_user_id()`) | Required for the audit story — DB rows attribute to actor + target |
| Audit log granularity | Per-write actions + session boundaries | Compliance pitch needs "what did they do," not just "they got in" |
| Target visibility | Audit-log accessible to teacher, no push notification | Avoids mid-class disruption; preserves transparency |
| Break-glass differentiation | Required reason + 15-min hard timeout + audit flag | Clear "this is different" without an email pipeline dependency |
| District scope | Promote `schools.district` to a `districts` table | Reliable joins; sets up future billing/contract attachment |
| Session lifecycle | Manual + 60-min inactivity (regular); 15-min hard (break-glass) | Balances support reality vs leaving keys in the door |
| Audit log scope | Foundation for Phase 4, not act-as-specific | One table, growing coverage; saves a later refactor |
| Concurrency | One actor per target; target session unaffected | Avoids write conflicts without disrupting the teacher |
