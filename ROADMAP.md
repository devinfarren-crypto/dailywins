# DailyWins Roadmap

Last updated: June 8, 2026

## Status
Phases **4 (audit log), 5 (act-as), and 6 (Site Admin schedule editor)** are shipped and live-verified. The "vendor cannot see student data, by database design" story is structurally true — RLS at the DB layer, audit triggers on PII + admin/config tables, PII-blind Operator/District-Admin tiers — and is now documented on `/privacy`. **Email is live (Resend)** and **magic links now work cross-device, both templates**. As of 6/08 the **Sure Step Education design system** is live across landing + dashboard (Fraunces / Public Sans / IBM Plex Mono, paper/ink palette, green accent, status scale; "Classic DailyWins" theme preserved), and the **all-perspectives** work shipped: a founder on-ramp to grant site_admin / district_admin roles (migration 033), a pure-admin landing fix, and student + co-teacher magic-link views — so all six vantage points (founder, teacher, site admin, district admin, parent, student) are now walkable. Pilot is approval-scoped; `devintest*` clutter is cleaned out. **Prod migration head: `033`.**

## Open — sorted by what blocks EGUSD (July 13) or tester growth
- **Demo script for EGUSD** — Devin is building it in a separate project. The compliance walkthrough: approve-under-audit → act-as picker → coral banner → audit-log artifact → break-glass as the strongest visual proof. Highest-leverage remaining July 13 item; Claude can draft a DW clickpath on request.
- ~~Demo Mode reseed.~~ **Verified healthy 6/02.** Live demo data already reflects the `1f6ba4a` fix (phoneAway non-zero in 1366/1590 rows, onTask in 1586/1590 — correct distributions, not the old all-zero bug) and is only ~4 days stale (Apr 6 → May 29). No reseed needed now; reseed for date-freshness right before a dry-run / the demo via **Demo Mode → Wipe → Seed** in the dashboard (or ask Claude to script it). Worth a quick in-app glance during a dry-run to confirm the dashboard *renders* it right.
- **General audit gap for direct admin/MCP SQL** — the trigger no-ops on service-role context (auth.uid() NULL). 032 + the 6/04 schedule-audit attribution closed this for *schedule* edits app-side (`writeAuditLog('schedule.update')` now stamps actor + acting-as); the general case (arbitrary admin SQL) still wants a session-variable "intended actor" so the trigger can attribute to a real user.
- **Drop `allowed_emails`** — vestigial since the auth-callback rewrite stopped reading it. Drop after a quiet observation period (snapshot first — it's a one-way door).

## Follow-ups from recent work
- **Re-evaluate the `school_schedules` table (~10h)** — was slated to move bell schedules out of hardcoded TS. The JSONB-on-`schools` column + the editor already solved the practical problem, so decide whether a normalized table still earns its cost before building it.
- **Live-verify the act-as schedule items** — build/typecheck pass, but founder-implicit edit (#2), act-as audit attribution (#3), and sliding expiry (#4) only fully exercise under an active act-as session. Walk one in prod: start act-as → edit a schedule → confirm the audit row carries `acting_as_user_id` and `expires_at` slides on activity. Optional: extend the act-as attribution lookup / trigger coverage to the `teachers` table.

## EGUSD July 13 prep
- ✅ Compliance story demo-able end-to-end: `/admin/requests` (approve under audit) → `/admin/teachers` (act-as) → coral banner → `/admin/audit-log`.
- ✅ `/privacy` reflects the shipped architecture (RLS, four-tier PII-blindness, audited act-as, magic-link, parent read-only link, Anthropic subprocessor). **Pending:** confirm exact data-residency region (de-specified "Ohio"→"US East"; prod is us-east-1), counsel eyeball on the PII-blindness + Anthropic "not used to train" wording.
- Demo script — not started (see Open).
- Mock meeting with Nick — not scheduled.
- Compliance *folder* (DPA templates: CSDPA / National DPA) — TODO; `/privacy` says we're ready to sign one.

## Recently shipped (newest first)
- **6/08 — All perspectives walkable: admin on-ramp + student/co-teacher links (`fe3c2a9`).** migration 033 `approve_access_request_as_role` lets a founder provision an approved request as teacher / site_admin / district_admin with the right scope; `/api/admin/approve` + approval modal gained a role+scope picker; new `/api/admin/districts`. Pure admins (role, no teachers row) now land on `/admin/teachers` instead of bouncing to `/pending`. New `/student/[token]` + `/coteacher/[token]` pages (shared `MagicLinkSummary`; parent refactored onto it); `ManageLinksModal` generates parent/student/co-teacher links. Build + typecheck green; migration applied to prod (user-authorized). Test-account walk on deployed prod still pending (Devin's +alias step).
- **6/08 — Sure Step Education design system (`966160b`).** Fraunces/Public Sans/IBM Plex Mono via next/font; full token set in Tailwind v4 `@theme`; landing + dashboard reskinned by repointing the `COLORS` constants + `default` theme to design tokens (standing zones now use the §2 status scale). "Classic DailyWins" theme preserved; Public Sans + Fraunces added to the font switcher.
- **6/04 — Phase 4/5/6 follow-ups (`659a73a`).** (1) Founder-implicit schedule edit: a founder manages any school's bell schedule without a `school_admins` row — `/admin/upload-schedule` loads all schools for founders, the save route falls back to `has_role('founder')`; both resolve via `effective_user_id()` so act-as scopes to the target. (2) Act-as attribution: `schedule.update` audit now stamps `acting_as_user_id` + `break_glass` via `getCurrentActAsSession()`. (3) Inactivity-based act-as expiry: regular sessions slide `expires_at` forward on activity (1 write / 5 min throttle); break-glass stays hard-capped. Build + typecheck green; live-verification under act-as still pending (see Follow-ups).
- **6/04 — "Magic Link" email template flipped (Devin).** The last open auth item; existing-user cross-device re-request links now work. Magic-link saga fully closed.
- **6/04 — Test-account cleanup.** Deleted ~9 `devintest*@proton.me` accounts (9 `auth.users` + 3 `access_requests`; one test teacher/role cascaded, 0 behavior rows). Snapshot at `.snapshots/2026-06-04-…json` (gitignored). 6 real users / 3 founders intact.
- **6/03 — Email live (Resend) + founder notifications.** Domain `send.dailywins.school` verified (DNS at GoDaddy: DKIM/SPF/MX/DMARC), `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` + `NOTIFY_TO_EMAIL` set in Vercel, Supabase custom SMTP wired (smtp.resend.com:465) so magic-link delivery is fast/reliable. `NOTIFY_TO_EMAIL` → `devinfarren@gmail.com` (surestep mailbox isn't bridged to Gmail). All verified in Resend logs. New domain → first sends land in Spam/Promotions until reputation warms (mark "Not spam").
- **6/03 — Cross-device magic links fixed (`73aef2c`).** Magic-link sign-in used the PKCE code flow (`exchangeCodeForSession` needs the requesting browser's `code_verifier` cookie) → clicking on a different device/browser left `email_confirmed_at` set but `last_sign_in_at` null, no session, no access-request row. New `/auth/confirm` route verifies a `token_hash` via `verifyOtp` (no cookie) → works cross-device; also accepts a `?code=` fallback. Shared provisioning gate extracted to `src/lib/auth-provision.ts` (used by both `/auth/callback` OAuth and `/auth/confirm` email). Email templates flipped to the `token_hash` URL (Confirm-signup verified; Magic-Link pending — see Follow-ups). Proven in prod via an incognito (cross-context) test.
- **6/03 — `/pending` gated + dead route removed (`aca6bfc`).** `/pending` was an ungated client page (unauth visitors saw the shell; its `/api/access-request/mine` fetch 401'd → "Unable to load your request status"). Now a server component: `getUser()` → redirect (no session → `/`, approved → `/dashboard`, denied/missing → `/access-denied`, pending → render with status/school as props). Removed `/api/access-request/mine` (sole consumer was `/pending`). Verified in prod (unauth `/pending` → 307 `/`; mine → 404).
- **6/02 — Phase 4 audit expansion (migration 032).** Generic 029 trigger extended to `role_assignments`, `school_admins`, `schools`, `districts` (alias map only; 029 tables untouched) → 21 triggers. Schedule edits (service-role) audited app-side. Applied + verified in prod (structural + rolled-back behavioral test, zero residue).
- **6/02 — `/privacy` refresh.** Now matches shipped security architecture; claims verified against live RLS policies.
- **6/01 — Phase 6 Site Admin schedule editor.** DB-backed page (loads the user's own `school_admins` schools), edit-existing path via `dbShapeToExtracted()`, merge vs replace save modes, add/remove variants & periods. Live-verified on prod; remove-period confirm + last-period guard added after testing.
- **6/01 — Migration 031, legacy arrival cleanup.** Finished the 6 out-of-range `arrival=3` rows the 5/27 live SQL missed (→ index 0). Applied + verified. Also closed the 027 ledger-name-drift and "May 27 staging RLS" non-items.
- **5/31 — Tommy pilot status resolved** (intentionally dormant; self-provisions via `/admin/requests`).
- **5/30 — Phase 4 audit triggers (029), `teachers.preferences` (030), "Show Period 0", `BELL_SCHEDULES` purge, passwordless magic-link login.**
- **5/29 — Break-glass UI** (founder-only, rose-red banner + required reason, 15-min timeout). Verified live.
- **Earlier — Phase 5 act-as (027/028):** districts/act_as_sessions/audit_log, `effective_user_id()`, RLS rewrite, act-as + break-glass routes, `/admin/teachers`, `/admin/audit-log`, `/audit/me`. **Beta access layer (022–026):** access_requests + RLS, approve RPC, `/pending`, `/admin/requests`.

## Pilot status (snapshot 6/04)
- **Devin** (founder + teacher) — PGHS; admins PGHS + COHS.
- **Nick** (teacher + Site Admin) — COHS.
- 6 `auth.users` total / 3 teachers after the `devintest*` cleanup.
- Approval-gated onboarding is the gate; `allowed_emails` is vestigial.

## Working guardrails (current)
- **Reversibility gate** (adopted 6/01): do anything reversible — including backed-up prod data writes; **always snapshot before a prod mutation.** Queue genuine one-way doors (force-push/history rewrite, un-backed-up destructive SQL, bulk ops, real-user emails, infra teardown, auth-config lockout) for an attended, approved moment.
- **Guarded-apply or stage-test migrations** — capture the restore point first; verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution, `effective_user_id()` for data access — mixing them caused both 5/29 act-as regressions.
- `onConflict` upserts require a real UNIQUE constraint — verify before trusting.
- RPC responses are not interchangeable with raw row SELECTs even on the same data — watch for shape mismatches.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel, one project, three domains. **Migration head: `033`.** Supabase MCP pinned to prod via an `sbp_…` PAT in `~/.claude.json` (no dev branches; staging is a separate, MCP-unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to save the t4g.nano cost; restoring takes a few minutes.
- **Git:** `main` is the only active branch.
