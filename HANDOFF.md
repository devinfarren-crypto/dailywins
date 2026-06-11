# Session Handoff

**Handoff passphrase: `copper-finch-mesa-12`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `copper-finch-mesa-12`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md) / [FIELD-GUIDE.md](FIELD-GUIDE.md).)

Last handoff: 2026-06-11

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `048`.**
Everything below is deployed. 6/11 was the **director-experience hardening
day**: the first NPS org (NBPS) exists on prod, its director walked the real
flow, and every rough edge they hit got fixed the same hour.

**The architecture (unchanged — read [FIELD-GUIDE.md](FIELD-GUIDE.md)):** ONE
app, no fork. `districts.org_type ('district'|'nps')` is the source of truth;
an NPS director holds site_admin + district_admin on a one-school org. The
6/10 go-to-market detail (migrations 041–047, pricing, link policy, records)
now lives in [ROADMAP.md](ROADMAP.md) → Recently shipped.

**Shipped 6/11 (chronological):**
- **Director home + gamified launch (`259097e`, `b8701c9`, `5d40202`)** —
  `/admin/home` is the first tab and the post-sign-in landing for site admins
  + NPS directors (no more empty usage page). One-step-at-a-time launch wizard
  on the navy Sure Step stage: progress bar with the amber dot, inline
  teacher-invite + link toggles, celebrations, localStorage persistence,
  auto-done from live data; finale settles into a mission-control view.
- **Lost-email rescue (`02657ab`, `a45a540`)** — "Resend sign-in" buttons on
  /admin/teachers rows + approved /admin/requests rows (founder: any
  provisioned user; site admin: own school; audited `signin_link.resend`).
  Landing page now says plainly the email box is also how you sign BACK in.
- **Schedule parse made bulletproof (048, `60b1547`→`cee63b1`→`8cf21d8`)** —
  the monster Monterey Trail PDF (17 variants) parses reliably. Root-caused a
  NetworkError chain via Vercel logs: 504 (maxDuration 60→300) → VPN killing
  idle connections (server 200, browser error) → **async job+poll**:
  `schedule_parse_jobs` table (048), POST returns job id, parse continues via
  `after()`, client polls `/api/schedule/parse/status` every 2.5s.
  `messages.stream().finalMessage()` at max_tokens 32768; 4MB client cap.
- **Review UX (`d9189ca`, `ffcf5c8`)** — review celebrates ("Got it — your
  schedule is in!") then asks **one quick check at a time** (progress dots,
  Looks-right-next) instead of a 9-bullet wall. Variant names auto-deduped at
  parse + before save (storage keys by name; the model legitimately repeats
  names); **save failures return to the review screen** with a fix-it banner —
  a reviewed parse is never thrown away. All three transactional emails teach:
  bookmark dailywins.school, NOT the one-time link.
- **Audit log unblocked (`b9f5081`)** — NPS directors (site_admin AND
  district_admin) were trapped with only Sign out; nav now shows for any
  site_admin. Actor emails resolve from public tables (PostgREST does NOT
  expose the auth schema — the old `.schema("auth")` read silently failed →
  raw UUIDs).
- **One navy band, anchored (`b7fd522`, `18c2747`, `6b0b821`)** — the admin
  experience reads as one product: shared `AdminNavyBand` (slim navy row,
  bars mark, serif title) sits directly under the tabs on EVERY admin tab;
  the uploader's full-bleed NavyStage is retired (states talk through the
  band's title; content in white cards). All seven tabs share one shell:
  cream paper, 1000px container, eyebrow + serif header → nav → band.
- **"What teachers see" demo dashboard (`6b0b821`)** — card on /admin/home:
  POST `/api/admin/demo-dashboard` (site_admin only) seeds the director's OWN
  teacher dashboard with seven [DEMO] students + 8 weeks of history, opens in
  a new tab. Mints a teachers row if missing, flagged
  `preferences.admin_first` so **sign-in still lands directors on
  /admin/home** (auth-provision honors the flag; real teacher rows never
  carry it). Idempotent reseed; audited `demo_dashboard.seed`.
- **Worktrees for two agents (`3fe1bc5`)** — `dailywins-frontend/` (frontend
  branch) + `dailywins-backend/` (backend branch) live next to the main
  folder; `.env.local` copied, deps installed, builds green. Quickstart in
  [ARCHITECTURE.md](ARCHITECTURE.md). Stale `claude/determined-black-d331b5`
  worktree+branch pruned (one-way-door item closed; its only file was a stale
  draft of schedules-schema.ts).

**Ops lesson (6/11):** the Vercel GitHub webhook MISSED a push once (`d9189ca`
never built — diagnosed via deployment list, fixed with an empty retrigger
commit `25f9faa`). After pushing, confirm a deployment actually exists; open
browser tabs keep old bundles until a hard refresh.

**Business (unchanged from 6/10):** $199/mo flat per school billed annually,
free 60-day pilot, founding $149/mo for life for the first 15 CA schools;
260-school CA NPS list in hand. Marketing site live at
dailywins-schools.vercel.app; `dw.surestepeducation.com` still awaits the
Cloudflare CNAME (`dw` → `cname.vercel-dns.com`, DNS-only).

**Local-only (this machine, NOT in git).** Firefox role profiles +
`DailyWins Roles.command`; `package.json` dev scripts stay UNCOMMITTED; the
two worktree folders carry copied `.env.local` files (re-copy if secrets
rotate); `dailywins-marketing/` and doc snapshots live outside git.

**Test accounts (prod).** **NBPS — the first NPS org — now exists:**
surestep3@proton.me was regranted as its pseudo-director (site_admin +
district_admin) and has walked home/launch/schedule/audit on prod; the
17-variant Monterey Trail schedule is on file at NBPS. South Sac cluster
(surestep2 district / devintest2 site_admin / devintest3 teacher @ proton.me)
unchanged. Founder = Devin's Google in Chrome.

⚠️ **Open verification (deployed prod, browser):**
1. **Monster-schedule retest** — upload the Monterey Trail PDF end-to-end on
   the NEW flow: band states → one-at-a-time checks → save (dedupe means no
   duplicate-name failure) → trophy. Fixes deployed; Devin's eyeball pending.
2. **"What teachers see" walk** — as the NBPS director: Home → demo dashboard
   card → new tab shows 7 [DEMO] students; sign out/in still lands /admin/home.
3. **NPS flow remainder** — invite a real teacher at NBPS → teacher's links
   respect the link policy (a disabled type hidden AND blocked).
4. Older: PDF B&W bars eyeball, arrival-fix eyeball, deactivate/reactivate
   walk, act-as schedule-edit live-verify.

**Known follow-ups:** /privacy §7 counsel eyeball; marketing launch steps
(CNAME → Nick dry-run → first 25-school batch); tier-doc gaps (district-admin
invites site-admins, non-teacher deactivate); general audit gap for direct
admin SQL; drop `allowed_emails` (one-way door, attended); Rose theme green
secondary (cosmetic). Back-pocket login upgrades Devin deferred: 6-digit OTP
code in the email, Microsoft SSO, passkeys.

## What's queued next
1. **The three verifications above** — they're the exact first-customer
   experience (schedule + demo dashboard + teacher links).
2. **Marketing launch steps** (CNAME → demo dry-run with Nick → first email
   batch from the 260-school list).
3. Counsel pass on /privacy §7.
4. Parking lot: tier-doc gaps, audit SQL gap, `allowed_emails` drop.

## Working guardrails (current)
- **Reversibility gate:** reversible work proceeds (incl. backed-up prod
  writes); **snapshot before every prod mutation;** queue one-way doors for an
  attended + approved moment.
- Guarded-apply or stage-test migrations — restore point first, verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution; `effective_user_id()` for data access.
- **After every push, confirm the Vercel deployment exists** (webhook can miss).
- Branch/worktree workflow in [ARCHITECTURE.md](ARCHITECTURE.md);
  service-call protocol + estate map in [FIELD-GUIDE.md](FIELD-GUIDE.md).
- **PII-blindness boundaries (post-047):** teachers → own students; NPS
  director → everything at their school (audited); district admins → aggregate
  + audited notes archive; site admins (district-shaped) → blind; Operator →
  blind (act-as + maintenance exceptions only).

## Infrastructure
- **Prod app:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Migration head:
  **`048`.** Vercel project `dailywins`, three domains. OTP expiry 86400s.
- **Marketing site:** Vercel project `dailywins-schools`
  (dailywins-schools.vercel.app) ← `dailywins-marketing/website/` via CLI.
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2), paused manually.
- **Company site:** surestepeducation.com = Netlify behind Cloudflare.
- **Git:** `main` deploys; `frontend`/`backend` are worktree branches
  (folders `dailywins-frontend/` / `dailywins-backend/`), all currently even
  with `main`.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Overwrite the passphrase line whenever you want a fresh marker.
The worktree folders are local to each machine — recreate with
`git worktree add ../dailywins-frontend frontend` (+ backend) if wanted there.
