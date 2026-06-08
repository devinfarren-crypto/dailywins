# Session Handoff

**Handoff passphrase: `umber-tarpon-willow-08`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `umber-tarpon-willow-08`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-08

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `038`.**
All three commits below are Vercel-deployed to prod.

**This session (6/08 pm) — three ships + a role-hierarchy test cluster:**
- **Sign-out on every admin surface (`9084c1a`).** Admin pages had no logout at
  all (the only `signOut()` lived on the teacher dashboard); district admins were
  stranded — the `/admin/usage` district branch rendered no nav whatsoever. Added
  a reusable **`SignOutButton`** (mirrors the dashboard session-clear → hard
  redirect to `/`) top-right on `/admin/usage` (both branches + error/empty
  states), `/admin/upload-schedule`, and `/admin/teachers` (site admin + founder).
- **Parent/student/co-teacher magic-link behavior CHARTS (`c839207`, migration
  038).** The magic-link summary showed one cumulative number per period (e.g.
  351) — meaningless to a parent. Replaced with a Daily/Weekly/Monthly toggle
  driving (1) an overall %-of-goals-met bar chart over time, color-graded
  green/gold/coral, and (2) a per-category breakdown labeled with the **teacher's
  own category names** — custom labels (Empathy / Organization / Timeliness) flow
  straight through from `teachers.categories` with the right colors + max points;
  **notes kept.** **Migration 038** extends `get_parent_view` / `get_student_view`
  / `get_coteacher_view` to return `score_date` + legacy per-category columns + the
  scoring teacher's `categories` (additive; existing fields, private-note rule, and
  scope guards all preserved). New `BehaviorCharts` + `BehaviorOverTimeChart`;
  Recharts isolated behind `dynamic(ssr:false)` (CLAUDE.md gotcha), per-category
  bars are plain CSS. Verified locally with synthetic data (custom labels render,
  notes preserved, chart deferred cleanly). Snapshot of the pre-038 RPCs at
  `.snapshots/038-pre-magic-link-views.sql`.
- **Teacher schedule pinned to the assigned school (`fa481c5`).** The Bell
  Schedule modal had a hardcoded two-school picker (`SCHOOLS = [COHS, PGHS]`) in
  `localStorage`, fully decoupled from the teacher's `school_id` — every teacher
  saw both pilot schools, and a teacher at any other school (e.g. South Sac HS) saw
  two schools that weren't even theirs. Now the school is set from
  `profile.school_name` (the site-admin-determined assignment) and shown
  **read-only** ("set by your school admin"); the teacher keeps only the
  schedule-variant + 1st/2nd lunch choices. Site-admin check now keys off
  `teacher.school_id` (works for any school); empty states for "no school assigned"
  and "no schedule set yet — ask your site admin"; dead `SCHOOLS` /
  `SCHOOL_NAME_TO_ID` / `BELL_SCHEDULES` / `SchoolName` / `handleSelectSchool`
  removed.

**Role-hierarchy test cluster (test data, DB-only — not in git).** Built a clean
vertical to exercise every tier in its own color-coded window:
**surestep2@proton.me** (district_admin @ *Sacramento*) → **devintest2@proton.me**
(site_admin @ *South Sac HS*) → **devintest3@proton.me** (teacher @ South Sac HS).
devintest3 was provisioned by devintest2 through the **email-bound teacher invite —
which this session WALKED end-to-end on deployed prod, and it works** (closes the
long-open invite verification). South Sac HS had no district, so `schools.district_id`
→ Sacramento (the district surestep2 already administers) so surestep2's PII-blind
usage rollup now covers the cluster (rollback: `.snapshots/039-south-sac-district.sql`).

**Local-only (this machine, NOT in git).** Firefox installed + three color-coded
Firefox profiles (Teacher/Site/District) launched together by `~/Desktop/DailyWins
Roles.command` / `npm run roles`, each pinned to dailywins.school. The `package.json`
dev scripts (`dev:ff`, `ff`, `roles`) are deliberately left **UNCOMMITTED** — the
`roles` script points at this machine's Desktop path and would break the other machine.

**Prior context (v1.1 admin tiers, 6/08 am — all in prod):** tier dashboards +
role-aware landings (034), Site Admin made PII-blind (035), email-bound invites +
deactivate (036/037), auth-loop proxy + `/auth/home` (`b5b202d`), `SiteAdminNav`
(`4a15ea6`). Full detail in ROADMAP "Recently shipped."

**Test accounts (prod, login works):** South Sac cluster above is the preferred
end-to-end role walk now. Pre-existing aliases still valid: `devinfarren+dwteacher`
(teacher @ PGHS), `+dwsite` (site_admin @ PGHS), `+dwdistrict` (district_admin @ Elk
Grove). Founder = Devin's Google (`devinfarren@gmail.com`, in Chrome). Use Google for
founder, **magic-link** for proton/+alias accounts.

⚠️ **Open verification (deployed prod, Devin's browser):**
1. **Deactivate/reactivate** a teacher from the Teachers roster (still unwalked).
2. **Parent / student / co-teacher magic-link round-trips** — parent-link rendering
   is proven (it's what surfaced the charts work); a visual pass on the NEW
   daily/weekly/monthly charts with a real link is still worth a glance.
3. The older **act-as schedule-edit** live-verify still stands.
   *(Email-bound teacher invite — now WALKED via the South Sac cluster ✅.)*

**Known follow-ups:**
- **Magic-link OTP expiry is 1h** → stale-link confusion. Raise to 24h in Supabase
  → Authentication → Email (config, not yet changed).
- Magic-link sign-in is **two emails** (our invite + Supabase's link); collapsing
  to one needs a server-generated sign-in link. Google path is already one click.
- **NEW — lunch-pref hardcode:** the Bell Schedule modal still has a
  `selectedSchool !== "Cosumnes Oaks High School"` special-case on the
  lunch-preference block (separate from the now-fixed school picker; minor cleanup).
- **Co-teacher write UI** still unbuilt (backend exists).
- **Scoped audit-read** (district/school per tier doc) — RLS still founder-only.
- Tier-doc gaps: district-admin invites site-admins, non-teacher deactivate flows,
  site-admin **magic-link revocation** backstop.

EGUSD July 13 prep remains the business headline (separate Demo Project); `/privacy`
sign-off + compliance/DPA folder still stand. **This chat's scope is the DailyWins
product + the admin tiers — not the demo/business.**

## What's queued next (product-focused)
1. **Raise the magic-link OTP expiry to 24h** (Supabase Auth settings) — biggest
   testing-friction win, still not done.
2. **Walk the remaining deployed-prod verifications** — deactivate/reactivate + a
   visual pass on the new parent magic-link charts. (Email-bound invite is done.)
3. **Site-admin magic-link revocation UI** — backend `revoke_magic_link` already
   allows site admins; needs a list-a-school's-links + revoke screen. Highest-value
   remaining tier-doc item for the compliance story.
4. **Co-teacher write path UI** (readwrite links) — optional polish.
5. **Lunch-pref hardcode cleanup** — drop the `!== "Cosumnes Oaks High School"`
   special-case in the schedule modal (or make it data-driven from the schedule).
6. **General audit gap for direct admin/MCP SQL** — 029 trigger no-ops on
   service-role context; wants a session-variable "intended actor."
7. **Cleanup (one-way door — snapshot first):** drop vestigial `allowed_emails`.
8. **Design-system follow-through (optional):** button solid/ghost hierarchy,
   Recharts palette ([ChartViews.tsx](app/dashboard/ChartViews.tsx)), retire
   emoji/confetti; standardize "DailyWins" vs "Daily Wins".

## Working guardrails (current)
- **Reversibility gate:** reversible work proceeds (incl. backed-up prod writes);
  **snapshot before every prod mutation;** queue one-way doors (force-push /
  history rewrite, un-backed-up destructive SQL, bulk ops, real-user emails,
  infra teardown, auth-config lockout) for an attended + approved moment.
- Guarded-apply or stage-test migrations — restore point first, verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution; `effective_user_id()` for data access.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel one project,
  three domains. Migration head: **`038`**. Supabase MCP pinned to prod via an
  `sbp_…` PAT in `~/.claude.json` (no dev branches; staging is a separate,
  MCP-unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to
  save the t4g.nano cost.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Overwrite the passphrase line whenever you want a fresh marker.
