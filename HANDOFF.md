# Session Handoff

**Handoff passphrase: `cobalt-heron-marble-09`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `cobalt-heron-marble-09`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-09

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `040`.**
Everything below is Vercel-deployed.

**This session (6/09) — co-teacher write, an arrival-charting bug fix, and a big
dashboard/Customize polish pass:**

- **Co-teacher readwrite links can actually WRITE (`9ba8d1f`, migration 039).** The
  banner promised "contribute shared scores and notes" but the page only rendered
  the read-only summary — the write UI was never built (the 021 RPCs existed, unused).
  Added **`CoteacherWritePanel`** (readwrite links only): an add-today's-scores form
  (period + per-category option buttons, writing the dashboard's exact encoding —
  option INDEX for arrival, points otherwise) + a shared-note composer, both via the
  **anon browser client** (the RPCs grant EXECUTE to public; they validate the token,
  require `readwrite`, attribute to the lead teacher). **Migration 039** makes
  `coteacher_write_score` an UPSERT that **merges per-key** into today's row (was a
  plain INSERT → unique-violation collisions). `router.refresh()` after a write.
  Snapshot `.snapshots/039-pre-coteacher-upsert.sql`.
- **Arrival was under-reported in ALL charts — fixed (`b0ea814`).** An "arrival"
  category stores the OPTION INDEX (its pointValues collide, e.g. `[3,0,3]`), but both
  chart paths' `extractScores` summed the stored value AS points → "On Time" (index 0)
  charted as **0** instead of 3. Confirmed against prod (arrival values are 0/1/2; was
  charting ~3% of max instead of the true ~92%). Added `pointsForRaw` (arrival →
  `pointValues[index]`) in BOTH `ChartViews` (dashboard) and `BehaviorCharts`
  (magic-link). Dashboard headline numbers were already right (`calculatePeriodPoints`);
  only the charts were wrong. ⚠️ **logic-verified, not yet eyeballed live.**
- **Progress-icon continuity (`ce434aa`, migration 040).** Narrowed the picker to three
  (⭐ 🏆 🎯). The teacher's chosen icon now badges the **parent/student/co-teacher
  magic-link view** (before the student name) AND the **Daily/Weekly PDFs** (top-right,
  via a canvas→PNG because jsPDF can't draw emoji as text — `emojiPngDataUrl`).
  **Migration 040** returns `progress_icon` from the three view RPCs (default ⭐).
  Rollback pointer `.snapshots/040-pre-progress-icon.sql` (re-run the 038 view bodies).
- **PDF reports → B&W-safe bar charts (`e45ab31`).** Daily + Weekly PDFs render each
  score cell as an **in-cell mini bar** whose LENGTH encodes the value, plus the printed
  number — so they read in color, grayscale, or pure B&W. autoTable `didDrawCell` +
  `drawCellBar()`; empty/absent cells show a dash. ⚠️ **browser-only output — needs a
  visual eyeball on a real download.**
- **Dashboard scoring-grid tweaks (`c46cd69`).** "Feedback to Devin" (a Google-Doc link)
  → `mailto:support@surestepeducation.com`. Removed the per-category "All → X" (vertical,
  fill-a-column) quick-fill buttons; the global **⚡ All / ✕ Clear** stay. Filling is now
  **horizontal**: clicking a period's title ("Period N", now a ⚡ button) fills that row
  with the standard defaults (`quickFillPeriod`).
- **Stale-feature removals.** **Parent View** modal+button (a stale single-day table that
  no longer matched the real magic-link charts), **School Team** ("Coming Soon"), **Student
  Sync** (disabled), **Export to Drive** (disabled Sheets export + ~140-line dead handler)
  — all gone (`e15c563`, `878db2f`).
- **Customize trims.** Color themes **9 → 6** (Sure Step, DailyWins [renamed from "Classic
  DailyWins"], Steel Blue, Sage Green, Lavender, Rose — Rose's gray header → lavender-purple
  so it reads pink) (`eb64cc0`). **Inter is now the only app font** — picker removed,
  decorative web fonts dropped (`6b26288`). **Compact Mode removed** (`206a0d1`).

**Local-only (this machine, NOT in git).** Firefox + three color-coded Firefox profiles
(Teacher/Site/District) via `~/Desktop/DailyWins Roles.command` / `npm run roles`; the
`package.json` dev scripts (`dev:ff`, `ff`, `roles`) stay **UNCOMMITTED** (machine-specific
Desktop path).

**Prior context (all in prod).** v1.1 admin tiers (034–037), magic-link behavior charts
(038), school-pinned schedule, admin sign-out, and the **South Sac role-hierarchy test
cluster**: surestep2 (district @ Sacramento) → devintest2 (site_admin @ South Sac HS) →
devintest3 (teacher @ South Sac HS), which walked the email-bound invite end-to-end. Full
detail in ROADMAP "Recently shipped" + git history.

**Test accounts (prod).** South Sac cluster (surestep2 / devintest2 / devintest3 @ proton.me,
magic-link) is the role walk. Pre-existing `devinfarren+dwteacher/+dwsite/+dwdistrict` (PGHS /
Elk Grove) still valid. Founder = Devin's Google (`devinfarren@gmail.com`, Chrome).

⚠️ **Open verification (deployed prod, browser):**
1. **PDF bar charts** — download a Daily + Weekly PDF; check bar sizing/placement + B&W
   readability (browser-only; couldn't auto-verify).
2. **Arrival charting fix** — confirm Arrival now reads ~90s% (not near-0) in the dashboard
   Weekly/Monthly charts and a parent link.
3. **Co-teacher write** — generate a readwrite co-teacher link → add a score + note → confirm
   the charts/notes update.
4. **Deactivate/reactivate** a teacher (still unwalked).
5. Older **act-as schedule-edit** live-verify still stands.

**Known follow-ups:**
- **Magic-link OTP expiry is 1h** → raise to 24h (Supabase → Authentication → Email; config,
  not done).
- Magic-link sign-in is **two emails**; a server-generated sign-in link would collapse to one.
- **Lunch-pref hardcode** — Bell Schedule modal still special-cases
  `selectedSchool !== "Cosumnes Oaks High School"` for the lunch toggle (minor).
- **Headings still use Fraunces** (`DISPLAY_FONT`) even though the body font is now Inter-only
  — unify to Inter if a single typeface is wanted.
- **Rose theme** keeps a green secondary; could go fully pink-purple.
- **`support@surestepeducation.com`** is the new feedback address; Devin expects a catch-all
  (misspellings land in his inbox) — worth confirming it receives.
- **Scoped audit-read** (district/school) — RLS still founder-only.
- Tier-doc gaps: district-admin invites site-admins, non-teacher deactivate, site-admin
  magic-link revocation backstop.

EGUSD July 13 prep remains the business headline (separate Demo Project); `/privacy` sign-off
+ compliance/DPA folder still stand. **This chat's scope is the DailyWins product + the admin
tiers — not the demo/business.**

## What's queued next (product-focused)
1. **Eyeball the new PDF bar charts + the arrival-charting fix** on deployed prod — the two
   things shipped-but-not-visually-confirmed this session.
2. **Raise the magic-link OTP expiry to 24h** (Supabase Auth) — biggest testing-friction win.
3. **Walk deactivate/reactivate** a teacher (last unwalked tier verification).
4. **Site-admin magic-link revocation UI** — backend `revoke_magic_link` already allows site
   admins; needs a list-a-school's-links + revoke screen. Top remaining tier-doc item.
5. **Small polish:** lunch-pref hardcode cleanup; optional single-typeface (Inter headings) /
   fully-pink Rose.
6. **General audit gap for direct admin/MCP SQL** — 029 trigger no-ops on service-role context;
   wants a session-variable "intended actor."
7. **Cleanup (one-way door — snapshot first):** drop vestigial `allowed_emails`.

## Working guardrails (current)
- **Reversibility gate:** reversible work proceeds (incl. backed-up prod writes); **snapshot
  before every prod mutation;** queue one-way doors (force-push / history rewrite, un-backed-up
  destructive SQL, bulk ops, real-user emails, infra teardown, auth-config lockout) for an
  attended + approved moment.
- Guarded-apply or stage-test migrations — restore point first, verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution; `effective_user_id()` for data access.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel one project, three domains.
  Migration head: **`040`**. Supabase MCP pinned to prod via an `sbp_…` PAT in `~/.claude.json`
  (no dev branches; staging is a separate, MCP-unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to save the t4g.nano
  cost.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's continue."*
Overwrite the passphrase line whenever you want a fresh marker.
