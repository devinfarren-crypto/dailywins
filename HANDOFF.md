# Session Handoff

**Handoff passphrase: `juniper-falcon-quarry-31`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `juniper-falcon-quarry-31`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-10

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `040`** (no DB
changes this session). Everything in-repo below is Vercel-deployed.

**This session (6/09 pm → 6/10) — company aesthetic, unified splash, the NPS marketing
campaign, and front-end/back-end organization:**

- **Sure Step Education company aesthetic adopted (`f36fe24`).** Applied the canonical
  [Sure_Step_Education_Aesthetic.md](Sure_Step_Education_Aesthetic.md) (now in repo root):
  DM Serif Display / DM Sans / DM Mono via next/font, `--ssd-*` tokens repointed to the
  company palette (navy `#1a1a2e`, forest `#0F6E56`, teal `#1D9E75`, amber `#EF9F27`,
  cream `#F7F5F0`), dashboard `COLORS`/default theme updated, theme-color → navy.
  ⚠️ Known leftovers: dashboard error boundary still coral `#e07850`; some marketing/landing
  hexes may be off-palette.
- **One smooth unified splash (`55cce1f` + `8c57fd7`).** All three loading moments (landing
  auth-check, dashboard shell, dashboard data) now render a single `Splash` (navy field,
  ascending-bars SVG drawing itself, wordmark fade — aesthetic MD §5). `SplashGate` in
  [app/layout.tsx](app/layout.tsx) holds it a fixed **2.5s** then dissolves 0.6s, so it can't
  "lightning-flash" on fast loads. Plays once per hard load (any route), not on client navs.
- **NPS marketing campaign built (NOT in this repo)** — lives at
  `Desktop/SURE STEP EDUCATION/dailywins-marketing/`: standalone marketing **website**
  (with an interactive tap-to-win demo grid), a 13-slide **deck** (HTML, Cmd+P → PDF),
  **cost-structure** proposal ($149/mo School tier + free 60-day pilot — **numbers need
  Devin/Nick sign-off**), a 15-min **demo script** (Demo-Mode-only, objection cheat-sheet),
  and a 4-email **director outreach sequence**. See its README for the launch order.
- **Marketing site is LIVE: <https://dailywins-schools.vercel.app>** — deployed as a NEW
  Vercel project `dailywins-schools` (separate from the app; app deploys untouched).
  `dw.surestepeducation.com` is the intended custom domain but needs Devin to add a
  Cloudflare DNS record first (CNAME `dw` → `cname.vercel-dns.com`, **DNS-only/grey cloud**),
  then re-run the Vercel domain attach. Note: surestepeducation.com itself is on **Netlify**
  behind Cloudflare; the local `surestep-site/` copy (Mar 29) has no git — do NOT redeploy
  it casually to get a `/dw` path.
- **Front-end/back-end organization (`5f51b53`).** New [ARCHITECTURE.md](ARCHITECTURE.md)
  maps every source file to front end vs back end, documents the three FE↔BE seams
  (browser RPCs, internal API routes, RLS table reads), and defines the branch workflow.
  **New persistent branches `frontend` and `backend`** (pushed to origin) for divided work;
  merge to `main` (auto-deploys) and refresh from `main` after. The repo was NOT physically
  split — App Router requires one tree. Nine stale merged local branches pruned
  (`feat/*`, `fix/*`, `design/*`). Leftover: branch `claude/determined-black-d331b5` +
  its `.claude/worktrees/` worktree couldn't be auto-removed (permission gate) — it's merged
  and inert; its one stray draft file is snapshotted at
  `.snapshots/worktree-draft-schedules-schema.ts` if you want to delete the worktree manually.

**Local-only (this machine, NOT in git).** Firefox role profiles + `~/Desktop/DailyWins
Roles.command`; `package.json` dev scripts (`dev:ff`, `ff`, `roles`) stay **UNCOMMITTED**
(machine-specific). The marketing folder + `~/Desktop/dailywins-aesthetic-for-claude.txt`
are also outside git — copy `dailywins-marketing/` manually if needed on the other machine.

**Prior context (all in prod).** 6/09 product day: co-teacher readwrite links can write
(migration 039), arrival-charting fix, progress-icon continuity (040), B&W-safe PDF bars,
multi-week/multi-month trend PDFs, Customize cleanup (6 themes, Inter-only). v1.1 admin
tiers (034–037), magic-link behavior charts (038), school-pinned schedule. South Sac
role-hierarchy test cluster (surestep2 → devintest2 → devintest3) walked end-to-end.
Full detail in ROADMAP "Recently shipped" + git history.

**Test accounts (prod).** South Sac cluster (surestep2 / devintest2 / devintest3 @
proton.me, magic-link). Pre-existing `devinfarren+dwteacher/+dwsite/+dwdistrict` (PGHS /
Elk Grove). Founder = Devin's Google (`devinfarren@gmail.com`, Chrome).

⚠️ **Open verification (deployed prod, browser):**
1. **Splash + aesthetic** — eyeball the 2.5s splash and the DM/navy reskin on prod
   (landing + dashboard + an admin page); revoke/tune if it reads wrong.
2. **PDF bar charts** — download a Daily + Weekly PDF; check bars + B&W readability.
3. **Arrival charting fix** — confirm Arrival reads ~90s% (not near-0) in charts + a parent link.
4. **Co-teacher write** — readwrite link → add score + note → confirm charts/notes update.
5. **Deactivate/reactivate** a teacher (still unwalked). Older act-as schedule-edit
   live-verify still stands.

**Known follow-ups:**
- **Marketing campaign sign-offs:** pricing numbers ($149/mo, pilot terms) with Nick;
  confirm `support@surestepeducation.com` actually receives (catch-all assumption);
  Cloudflare CNAME for `dw.surestepeducation.com`; DPA template ready before first pilot.
- **Magic-link OTP expiry is 1h** → raise to 24h (Supabase → Authentication → Email).
- Magic-link sign-in is two emails; a server-generated link would collapse to one.
- **Lunch-pref hardcode** (`!== "Cosumnes Oaks High School"`) in the Bell Schedule modal.
- **Error boundary still coral**; optional deeper aesthetic pass on marketing/landing hexes.
- **Scoped audit-read** (district/school) — RLS still founder-only.
- Tier-doc gaps: district-admin invites site-admins, non-teacher deactivate, site-admin
  magic-link revocation backstop.

EGUSD July 13 prep remains the business headline (separate Demo Project); `/privacy`
sign-off + compliance/DPA folder still stand.

## What's queued next
1. **Eyeball on prod:** splash/aesthetic, PDF bar charts, arrival fix (the three
   shipped-but-unconfirmed visuals).
2. **Marketing launch steps** (from `dailywins-marketing/README.md`): pricing sign-off →
   Cloudflare CNAME for `dw.` → dry-run the demo script on freshly-seeded Demo Mode →
   first 25-school email batch.
3. **Raise magic-link OTP expiry to 24h** (Supabase Auth config).
4. **Walk deactivate/reactivate** a teacher.
5. **Site-admin magic-link revocation UI** (backend already permits; needs the screen).
6. **Small polish:** lunch-pref hardcode; error-boundary palette; optional Rose/typeface unification.
7. **General audit gap for direct admin/MCP SQL** — session-variable "intended actor."
8. **Cleanup (one-way doors — attended):** drop vestigial `allowed_emails`; remove the stale
   `claude/determined-black-d331b5` worktree + branch.

## Working guardrails (current)
- **Reversibility gate:** reversible work proceeds (incl. backed-up prod writes); **snapshot
  before every prod mutation;** queue one-way doors (force-push / history rewrite, un-backed-up
  destructive SQL, bulk ops, real-user emails, infra teardown, auth-config lockout) for an
  attended + approved moment.
- Guarded-apply or stage-test migrations — restore point first, verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution; `effective_user_id()` for data access.
- **Branch workflow now in [ARCHITECTURE.md](ARCHITECTURE.md):** UI work on `frontend`,
  server/data work on `backend`, cross-cutting features as one branch off `main`; `main`
  stays deployable (every push auto-deploys prod).

## Infrastructure
- **Prod app:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel project, three domains.
  Migration head: **`040`**. Supabase MCP pinned to prod via an `sbp_…` PAT in `~/.claude.json`.
- **Marketing site:** separate Vercel project `dailywins-schools`
  (<https://dailywins-schools.vercel.app>), deployed via CLI from
  `dailywins-marketing/website/` (linked there via its `.vercel/` folder — redeploy with
  `npx vercel deploy --prod --yes` from that folder).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to save cost.
- **Company site:** surestepeducation.com = Netlify behind Cloudflare (DNS in Cloudflare).

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's continue."*
Overwrite the passphrase line whenever you want a fresh marker.
