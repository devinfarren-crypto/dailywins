# DailyWins Roadmap

Last updated: June 2, 2026

## Status
Phases **4 (audit log), 5 (act-as), and 6 (Site Admin schedule editor)** are shipped and live-verified. The "vendor cannot see student data, by database design" story is structurally true — RLS at the DB layer, audit triggers on PII + admin/config tables, PII-blind Operator/District-Admin tiers — and is now documented on `/privacy`. Pilot is approval-scoped to a handful of teachers. **Prod migration head: `032`.**

## Open — sorted by what blocks EGUSD (July 13) or tester growth
- **Resend setup** — ⚠️ *only Devin can do.* Step-by-step checklist (verified against the code path 6/02): **[docs/RESEND_SETUP.md](docs/RESEND_SETUP.md)**. Covers domain DNS, the 3 Vercel env vars (founder notification), and Supabase custom SMTP (magic-link delivery). Code is dormant and ready (`resend@^6.12.4` installed). *This is the real blocker on adding testers.*
- **Demo script for EGUSD** — not started. The compliance walkthrough: approve-under-audit → act-as picker → coral banner → audit-log artifact → break-glass as the strongest visual proof. Highest-leverage remaining July 13 item.
- **Inactivity-based renewal of `expires_at`** — act-as sessions hard-expire 60 min from start; long support calls get bumped mid-troubleshoot.
- ~~Demo Mode reseed.~~ **Verified healthy 6/02.** Live demo data already reflects the `1f6ba4a` fix (phoneAway non-zero in 1366/1590 rows, onTask in 1586/1590 — correct distributions, not the old all-zero bug) and is only ~4 days stale (Apr 6 → May 29). No reseed needed now; reseed for date-freshness right before a dry-run / the demo via **Demo Mode → Wipe → Seed** in the dashboard (or ask Claude to script it). Worth a quick in-app glance during a dry-run to confirm the dashboard *renders* it right.
- **General audit gap for direct admin/MCP SQL** — the trigger no-ops on service-role context (auth.uid() NULL). 032 closed this for *schedule* edits app-side (`writeAuditLog('schedule.update')`); the general case (arbitrary admin SQL) still wants a session-variable "intended actor" so the trigger can attribute to a real user.
- **Drop `allowed_emails`** — vestigial since the auth-callback rewrite stopped reading it. Drop after a quiet observation period (snapshot first — it's a one-way door).

## Follow-ups from recent work
- **Founder-implicit schedule-edit access** (P6) — founders without a `school_admins` row for a school can't edit its schedule (matches save-route authz). Wire founder-implicit edit, or auto-insert a `school_admins` row on school creation, for the "founder onboards a 3rd school" story.
- **Act-as attribution on the `schedule.update` audit** (P4 parity) — the app-layer schedule audit stamps `actor_user_id` but not `acting_as_user_id`; add the act-as lookup to match the triggers. Optional: extend trigger coverage to the `teachers` table.
- **Re-evaluate the `school_schedules` table (~10h)** — was slated to move bell schedules out of hardcoded TS. The JSONB-on-`schools` column + the new editor already solved the practical problem, so decide whether a normalized table still earns its cost before building it.

## EGUSD July 13 prep
- ✅ Compliance story demo-able end-to-end: `/admin/requests` (approve under audit) → `/admin/teachers` (act-as) → coral banner → `/admin/audit-log`.
- ✅ `/privacy` reflects the shipped architecture (RLS, four-tier PII-blindness, audited act-as, magic-link, parent read-only link, Anthropic subprocessor). **Pending:** confirm exact data-residency region (de-specified "Ohio"→"US East"; prod is us-east-1), counsel eyeball on the PII-blindness + Anthropic "not used to train" wording.
- Demo script — not started (see Open).
- Mock meeting with Nick — not scheduled.
- Compliance *folder* (DPA templates: CSDPA / National DPA) — TODO; `/privacy` says we're ready to sign one.

## Recently shipped (newest first)
- **6/02 — Phase 4 audit expansion (migration 032).** Generic 029 trigger extended to `role_assignments`, `school_admins`, `schools`, `districts` (alias map only; 029 tables untouched) → 21 triggers. Schedule edits (service-role) audited app-side. Applied + verified in prod (structural + rolled-back behavioral test, zero residue).
- **6/02 — `/privacy` refresh.** Now matches shipped security architecture; claims verified against live RLS policies.
- **6/01 — Phase 6 Site Admin schedule editor.** DB-backed page (loads the user's own `school_admins` schools), edit-existing path via `dbShapeToExtracted()`, merge vs replace save modes, add/remove variants & periods. Live-verified on prod; remove-period confirm + last-period guard added after testing.
- **6/01 — Migration 031, legacy arrival cleanup.** Finished the 6 out-of-range `arrival=3` rows the 5/27 live SQL missed (→ index 0). Applied + verified. Also closed the 027 ledger-name-drift and "May 27 staging RLS" non-items.
- **5/31 — Tommy pilot status resolved** (intentionally dormant; self-provisions via `/admin/requests`).
- **5/30 — Phase 4 audit triggers (029), `teachers.preferences` (030), "Show Period 0", `BELL_SCHEDULES` purge, passwordless magic-link login.**
- **5/29 — Break-glass UI** (founder-only, rose-red banner + required reason, 15-min timeout). Verified live.
- **Earlier — Phase 5 act-as (027/028):** districts/act_as_sessions/audit_log, `effective_user_id()`, RLS rewrite, act-as + break-glass routes, `/admin/teachers`, `/admin/audit-log`, `/audit/me`. **Beta access layer (022–026):** access_requests + RLS, approve RPC, `/pending`, `/admin/requests`.

## Pilot status (snapshot 6/02)
- **Devin** (founder + teacher) — PGHS; admins PGHS + COHS.
- **Nick** (teacher + Site Admin) — COHS.
- Throwaway/test accounts — Sacramento HS + a magic-link test school.
- Approval-gated onboarding is the gate; `allowed_emails` is vestigial.

## Working guardrails (current)
- **Reversibility gate** (adopted 6/01): do anything reversible — including backed-up prod data writes; **always snapshot before a prod mutation.** Queue genuine one-way doors (force-push/history rewrite, un-backed-up destructive SQL, bulk ops, real-user emails, infra teardown, auth-config lockout) for an attended, approved moment.
- **Guarded-apply or stage-test migrations** — capture the restore point first; verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution, `effective_user_id()` for data access — mixing them caused both 5/29 act-as regressions.
- `onConflict` upserts require a real UNIQUE constraint — verify before trusting.
- RPC responses are not interchangeable with raw row SELECTs even on the same data — watch for shape mismatches.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel, one project, three domains. **Migration head: `032`.** Supabase MCP pinned to prod via an `sbp_…` PAT in `~/.claude.json` (no dev branches; staging is a separate, MCP-unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to save the t4g.nano cost; restoring takes a few minutes.
- **Git:** `main` is the only active branch.
