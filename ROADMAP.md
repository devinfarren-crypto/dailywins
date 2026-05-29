# DailyWins Roadmap

Last updated: May 29, 2026 (EOD)

Phase 5 (act-as) shipped end-to-end and verified live. EGUSD compliance story now demo-able: approve-gated onboarding + audit-logged act-as + teacher self-serve transparency. Four pilot teachers in production (3 humans + 1 throwaway), all four-tier roles modeled in the schema.

## Shipped this week
- **Beta access layer (data, migrations 022–024):** `access_requests` table + RLS, `approve_access_request` RPC (atomic provisioning), `ensure_teacher_exists` hardened.
- **Beta access layer (app):** `/pending` page, sign-in-first auth callback, founder `/admin/requests` queue with Approve/Deny + school picker, Resend email notification dormant until env vars set.
- **Bugs fixed:** Period-0 save (migration 025), L/E arrival ambiguity (adaeb5f + 2c70d2f), arrival bulk-fill + mobile encoding, legacy `arrival = 3` cleanup (live SQL, captured as no-op in migration 026), demo-seed encoding mismatch (post-arrival-rewrite).
- **Sign-in UX:** Google `prompt=select_account` so multi-account users get the picker every time.
- **UNIQUE(user_id) on access_requests** (migration 026) so onConflict upserts actually work.
- **Phase 5 act-as (today):**
  - Migration 027: `districts`, `act_as_sessions`, `audit_log`, `schools.district_id`, `role_assignments.district_id`, `effective_user_id()`. Backfill PGHS + COHS → "Elk Grove Unified School District"; Sacramento HS → "Sacramento".
  - Migration 028: RLS rewrite — `has_role()` + `is_school_admin()` + 14 PII policies now route through `effective_user_id()`. Attribution-stamping kept on `auth.uid()`.
  - Server routes: act-as start/end + break-glass start; `canActAs()` + `canBreakGlass()` scope helpers; `writeAuditLog()` server helper + `fireAuditEvent()` client helper.
  - UI: `/admin/teachers` picker, sticky in-session ActAsBanner with Exit, `/admin/audit-log` (founder global), `/audit/me` (self-serve "who acted as me" + "what I've done").
  - Audit writes wired into approve/deny + score save + note CRUD + student add/delete. Client writes audit only when act-as'd (avoids classroom-write blowup).
  - Two regressions caught and fixed mid-test: dashboard was loading the actor's teacher profile instead of the target's (used `u.id` instead of going through RLS); subsequent SELECT-shape vs RPC-shape mismatch (`id` vs `teacher_id`) silently broke note + score writes during act-as.

## Open — sorted by what blocks EGUSD or tester growth
- **Resend setup** (only Devin can do): sign up, verify `dailywins.school` DNS, set `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` + `NOTIFY_TO_EMAIL` in Vercel. Code is dormant and ready.
- **Break-glass path untested.** Route exists, no UI yet, never exercised end-to-end. ~15 min of UI + one test session.
- **Inactivity-based renewal of `expires_at`.** Sessions hard-expire 60 min from start; long support calls get bumped mid-troubleshoot.
- **Demo Mode cosmetic bugs:** Phone Out of Sight / On Task showing zero in demo seed data only. Now fixed in code (1f6ba4a); existing demo data needs a wipe+reseed to pick it up.
- **`teachers.preferences` drift:** column exists on staging, not prod. Footgun — bit us today during the SELECT-shape fix. Decide: add to prod, or drop from staging.
- **Capture live-only fixes as migration files:** legacy arrival cleanup, May 27 staging roles RLS fix, migration 027 v2 vs the local file (named drift in `schema_migrations`).
- **`allowed_emails` is vestigial** since the auth callback rewrite stopped reading it. Drop after a quiet observation period.
- **Supabase migrations tracking drift:** prod's `schema_migrations` table has 11 entries; local has 28 files. Reconcile if it matters before EGUSD.
- **Audit gap (v1.5 candidate):** student CRUD now logged, but a determined teacher could bypass the client-side `fireAuditEvent` call. Postgres triggers on `behavior_scores` + `notes` + `students` would guarantee coverage. ~1h.

## Larger pieces
- **`school_schedules` table** (move bell schedules out of hardcoded TypeScript). Cost: ~10h. Promoted to "before July 13" because admin UI now onboards a third school instantly and the EGUSD pitch needs this story straight.
- **Phase 4 generalized audit log expansion** — coverage is already at score/note/student/access-request. Extend to role changes, school edits, schedule edits. Mostly mechanical with the helper in place.
- **Phase 6 Site Admin schedule editor** — sequenced after `school_schedules`.

## EGUSD July 13 prep
- ✅ Compliance story is now demo-able: `/admin/requests` (approve under audit) → `/admin/teachers` (act-as picker) → coral banner in act-as session → `/admin/audit-log` (every action recorded with actor + acting-as).
- **Compliance folder refresh** — partial. Privacy page at `/privacy` barely mentions any of the new beta-access infrastructure. Should be updated to reflect that approve-gated onboarding + audit-logged act-as + PII-blind admin roles are now real, not hypothetical.
- **Demo script** — not addressed. Should center on the four-tier model + the audit-log artifact.
- **Mock meeting with Nick** — not scheduled.
- **Break-glass demo path** — would land harder than regular act-as because the rose-red banner + required reason field is the strongest visual proof.

## Pilot status (snapshot 5/29/2026)
- Devin (founder + teacher) — PGHS
- Tommy (teacher) — PGHS
- Nick (teacher) — COHS
- iwhowanders (throwaway test) — Sacramento HS, approved 5/28 via the new admin UI
- Approval-gated onboarding is the gate; `allowed_emails` table is vestigial.

## Tracked cautions (carried forward)
- Read prod / write staging / propose prod writes. No autonomous prod schema or data writes by any Claude instance.
- Stage-test, **then** commit migrations — not the reverse.
- A passing type-check is not a working feature. Two bugs today were caught only by Devin exercising the act-as feature end-to-end. Always close the loop in the browser.
- `onConflict` upserts require a real UNIQUE constraint. Verify before trusting.
- `auth.uid()` for attribution, `effective_user_id()` for data access. Mixing them is what caused both 5/29 regressions.
- Watch for shape mismatches: RPC responses are not interchangeable with raw row SELECTs even when the underlying data is the same.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel one project, three domains.
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2) — paused 5/28. Restore before any staging-first work, or commit to Supabase branches.
- **Git:** `main` is the only active branch. Latest commit: see `git log -1`.
