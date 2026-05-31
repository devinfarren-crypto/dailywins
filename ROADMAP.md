# DailyWins Roadmap

Last updated: May 30, 2026 (late afternoon)

Phase 5 (act-as) shipped end-to-end and verified live. **Phase 4 audit triggers shipped today** (migration 029) — the "vendor can't see student data" claim is now structurally true at the database layer, not just at the app layer. EGUSD compliance story now demo-able end-to-end. Four pilot teachers' worth of rows in production, all four-tier roles modeled in the schema.

## Shipped today (5/30 afternoon)
- **Phase 4 audit triggers (migration 029, commit `6f40bc7`).** Postgres triggers on `behavior_scores` / `notes` / `students` write `audit_log` rows for every INSERT/UPDATE/DELETE. No-ops on service-role writes (auth.uid() NULL) so server routes' own `writeAuditLog` calls aren't duplicated. Staging-tested across 4 cases (regular teacher, act-as, service-role no-op, break-glass), prod-applied, then validated under unscripted load by a Chrome Claude agent that the triggers captured cleanly in 35 audit rows.
- **`teachers.preferences` column (migration 030, commit `54d48a1`).** Adds `jsonb DEFAULT '{}'` to `teachers`. Closes the staging/prod drift that was making every Customize toggle silently fail to persist. Dashboard SELECT now reads the column too — toggles round-trip across sign-out / sign-in.
- **"Show Period 0" toggle** (same commit). Period 0 is hidden by default — teachers almost never collect behavior data before school. One-line filter in `trackablePeriods`, new toggle in Customize, persisted via 030. Existing teachers will see their grid shrink to the periods they actually use.
- **Stale `BELL_SCHEDULES` fallback purged** (same commit). The hardcoded TS constant in DashboardClient.tsx had diverged from `schools.schedules` JSONB (missing Period 0, lunch break entries, Monday Period 4). Now `{}` for both schools; DB is the sole source of truth, and a DB read failure shows nothing rather than misleading stale data.
- **Test data cleanup on prod.** One test note from the Chrome agent's session deleted. Period 0 score values left as-is (the agent only mutated Period 0, which is rarely real data anyway).
- **Migration drift reduced.** Staging caught up by replaying migrations 014–028 (it had been at 013b_role_grants). Prod's `schema_migrations` head is now `030_teachers_preferences`. Drift between repo and prod history is smaller but not fully closed.

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
- **Passwordless email login (5/30):** magic-link sign-in (`signInWithOtp`) added alongside Google SSO in [app/page.tsx](app/page.tsx), so non-Google accounts (proton/outlook/etc.) can join. Routes through the same `/auth/callback` gate → identical access-request approval + RLS; only the credential differs. Verified end-to-end live (non-Google email → `/pending`). Supabase prod auth config done (Email provider on, `localhost:3000/**` redirect added). Prod-grade delivery still gated on Resend/SMTP (see Open) — built-in sender is rate-limited + spammy. CLAUDE.md auth/allowlist docs corrected to match (approval-gated, not allowlist-gated).
- **Break-glass UI (5/29):** founder-only `/admin/break-glass` page — any-role candidate list (teachers + admins, identity via `access_requests`), confirmation modal with required reason + 15-min hard-timeout warning, rose-red styling. Posts to the existing `break-glass/start` route; banner already rendered the break-glass state. Rose link added to dashboard founder tools. Verified end-to-end live (Devin → break-glass into Nick @ COHS; RLS resolved to target's data, banner + reason correct). Header chip intentionally keeps showing the actor (attribution via `auth.uid()`), per design decision 5/29.

## Open — sorted by what blocks EGUSD or tester growth
- **Resend setup** (only Devin can do): sign up, verify `dailywins.school` DNS, set `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` + `NOTIFY_TO_EMAIL` in Vercel. Code is dormant and ready. **Double-duty:** also wire it as Supabase custom SMTP so magic-link emails stop using the rate-limited built-in sender.
- **Inactivity-based renewal of `expires_at`.** Sessions hard-expire 60 min from start; long support calls get bumped mid-troubleshoot.
- **Demo Mode cosmetic bugs:** Phone Out of Sight / On Task showing zero in demo seed data only. Now fixed in code (1f6ba4a); existing demo data needs a wipe+reseed to pick it up.
- ~~Investigate "Tommy" pilot status.~~ **Resolved 5/31:** intentionally dormant — Tommy is a friend who may not use the app for months. His absence from `public.teachers` is expected, not a bug. He'll self-provision through `/admin/requests` whenever he signs in. No action needed.
- **Capture live-only fixes as migration files:** legacy arrival cleanup, May 27 staging roles RLS fix, migration 027 v2 vs the local file (named drift in `schema_migrations`). Today's catch-up handled staging 014–028 but live-only prod fixes are still outstanding.
- **`allowed_emails` is vestigial** since the auth callback rewrite stopped reading it. Drop after a quiet observation period.
- **Audit-log coverage gap for MCP / admin-tool writes.** 029 trigger by design no-ops on service-role context (auth.uid() NULL), so direct admin SQL — e.g. the test-note delete done today — leaves no `audit_log` row. Future admin tooling that expands beyond chat-mediated approvals will want a session-variable "intended actor" mechanism so the trigger can attribute to a real user.

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

## Pilot status (snapshot 5/30/2026)
- Devin (founder + teacher) — PGHS
- Nick (teacher) — COHS
- iwhowanders (throwaway test) — Sacramento HS, approved 5/28
- devintest2@proton.me (magic-link test) — separate test school
- Approval-gated onboarding is the gate; `allowed_emails` table is vestigial.
- **Tommy: listed in earlier ROADMAPs as PGHS teacher but not in `public.teachers`.** Investigate / re-provision / remove from pilot list.

## Tracked cautions (carried forward)
- Read prod / write staging / propose prod writes. No autonomous prod schema or data writes by any Claude instance.
- Stage-test, **then** commit migrations — not the reverse.
- A passing type-check is not a working feature. Two bugs today were caught only by Devin exercising the act-as feature end-to-end. Always close the loop in the browser.
- `onConflict` upserts require a real UNIQUE constraint. Verify before trusting.
- `auth.uid()` for attribution, `effective_user_id()` for data access. Mixing them is what caused both 5/29 regressions.
- Watch for shape mismatches: RPC responses are not interchangeable with raw row SELECTs even when the underlying data is the same.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel one project, three domains. Migrations head: `030_teachers_preferences`.
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). **Active** as of 5/30 (restored mid-day for the 029 + 030 staging-first pass). Re-pause manually if you want to save the t4g.nano cost.
- **Git:** `main` is the only active branch. Latest commit: see `git log -1`.
