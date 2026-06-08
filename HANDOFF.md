# Session Handoff

**Handoff passphrase: `slate-bluefin-ember-08`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `amber-falcon-lantern-37`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-08

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `037`.**
Huge session: the design system + all-perspectives work (recorded in the prior
033 refresh) PLUS the entire **v1.1 admin-tier build-out** shipped to prod across
several merges (all Vercel-deployed). Every tier is now walkable with a real
home, and the teacher invite flow was rebuilt to actually work.

**Test accounts (prod, login works via magic-link):** `devinfarren+dwteacher`
(teacher @ PGHS), `+dwsite` (site_admin @ PGHS), `+dwdistrict` (district_admin @
Elk Grove Unified). Founder = Devin's Google (`devinfarren@gmail.com`, founder +
teacher @ PGHS). NOTE: the three were first mis-approved as *teacher* via the
on-ramp modal (Role dropdown left default) → SQL-patched to correct roles +
removed a junk "Teacher HS" school (snapshot in `.snapshots/`). Use **Google for
founder, magic-link for the +aliases** (a `+alias` isn't a Google account).

**Shipped since the 033 refresh:**
- **Tier dashboards + role-aware landings (034, `1d48202`).** Site admin home =
  bell-schedule uploader; **its gating was migrated off the legacy `school_admins`
  table to `role_assignments`** (page + `/api/schedule/save` both honor a
  `role_assignments` site_admin now). District admin home = **PII-blind usage
  dashboard `/admin/usage`** (per-school rollups + schedule coverage), fed by
  SECURITY DEFINER aggregate RPCs `get_district_usage` / `get_site_usage` that
  return counts only. Per the tier doc, **district admins no longer see a teacher
  roster** — `/admin/teachers` is founder + site_admin, district admins redirect
  to `/admin/usage`. Landings resolved in `auth-provision`.
- **Site Admin made truly PII-blind (035, `cd16574`).** Three RLS policies
  (`scores_role_read` / `notes_role_read` / `students_role_read`) had granted a
  site_admin read access to student scores / shared notes / roster — contradicting
  the `/privacy` claim. Removed only the `has_role('site_admin', …)` clause;
  teacher access untouched. Verified under RLS: site admin now gets 0 rows, a real
  teacher still gets 12 students + 1680 scores. (District admin + founder were
  already PII-blind.)
- **Invite + deactivate teachers (036 → redesigned by 037).** Deactivation:
  `teachers.deactivated_at` + `set_teacher_active` (founder/site_admin scoped),
  blocks login at the gate + mid-session, reversible, audited. Invites: rebuilt as
  **email-bound** (037) after the URL-token approach broke (the magic-link email
  template drops `?invite=`, so invited teachers fell to a pending signup).
  Now: admin types the teacher's email on `/admin/teachers` → `create_teacher_invite`
  binds it + Resend emails the teacher (`send-teacher-invite.ts`) → on sign-in
  `claim_email_teacher_invite` matches the verified email and provisions them →
  straight to `/dashboard`. `/?email=` prefills the landing page; the old
  `?invite=` plumbing is gone.
- **Auth-loop fix (`b5b202d`) — important infra.** There was **no session-refresh
  middleware** even though `supabase-server.ts` relied on one, so server-rendered
  admin pages lost the session after the ~1h token life. Added **`proxy.ts`**
  (Next 16's renamed middleware) running the canonical Supabase refresh. Also the
  landing page sent *every* authed user to `/dashboard`, trapping admin accounts
  in a `/dashboard`↔`/pending` loop → added **`/auth/home`**, a role-aware
  resolver the landing page + dashboard fallback now route through.
- **Site Admin nav (`4a15ea6`).** `SiteAdminNav` cross-links the three site-admin
  surfaces (Bell schedules · Teachers · School usage) — they were unreachable from
  each other.

⚠️ **Open verification (deployed prod, Devin's browser):**
1. **Email-bound teacher invite end-to-end** — built + 037 applied, but NOT yet
   walked: as `+dwsite`, invite `devintest3@proton.me` → teacher gets the Resend
   email (check spam — sending domain still warming) → signs in with that email →
   should land on a PGHS teacher dashboard. Cleaned the stray devintest3 pending
   request + dead invite so it's a clean slate.
2. **Deactivate/reactivate** a teacher from the Teachers roster.
3. **Parent / student / co-teacher** magic-link round-trips (link gen works;
   round-trips unwalked).
4. The older **act-as schedule-edit** live-verify still stands.

**Known follow-ups surfaced this session:**
- **Magic-link OTP expiry is 1h** → stale-link confusion. Recommend raising to
  24h in Supabase → Authentication → Email (config, not yet changed).
- Magic-link sign-in is **two emails** (our invite + Supabase's sign-in link);
  collapsing to one needs a server-generated sign-in link. Google path is already
  one click.
- **Co-teacher write UI** still unbuilt (backend exists).
- **Scoped audit-read** (district/school per tier doc) — RLS still founder-only.
- Tier-doc capabilities still unbuilt: district-admin invites site-admins,
  deactivate flows for non-teachers, site-admin **magic-link revocation** backstop.

EGUSD July 13 prep remains the business headline (separate Demo Project); `/privacy`
sign-off + compliance/DPA folder still stand. **This chat's scope is the DailyWins
product + the admin tiers — not the demo/business.**

## What's queued next (product-focused)
1. **Walk the deployed-prod verifications above** (esp. the email-bound invite
   round-trip + deactivate) — the only thing between "built" and "proven."
2. **Raise the magic-link OTP expiry to 24h** (Supabase Auth settings) — biggest
   testing-friction win.
3. **Site-admin magic-link revocation** — backend `revoke_magic_link` already
   allows site admins; needs a UI (list a school's links + revoke). Highest-value
   remaining tier-doc item for the compliance story.
4. **Co-teacher write path UI** (readwrite links) — optional polish.
5. **General audit gap for direct admin/MCP SQL** — 029 trigger no-ops on
   service-role context; wants a session-variable "intended actor."
6. **Cleanup (one-way door — snapshot first):** drop vestigial `allowed_emails`.
7. **Design-system follow-through (optional):** button solid/ghost hierarchy,
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
  three domains. Migration head: **`037`**. Supabase MCP pinned to prod via an
  `sbp_…` PAT in `~/.claude.json` (no dev branches; staging is a separate,
  MCP-unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to
  save the t4g.nano cost.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Overwrite the passphrase line whenever you want a fresh marker.
