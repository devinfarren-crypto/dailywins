# Session Handoff

**Handoff passphrase: `harbor-lynx-ember-47`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `harbor-lynx-ember-47`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md) / [FIELD-GUIDE.md](FIELD-GUIDE.md).)

Last handoff: 2026-06-10 (evening)

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `047`.**
Everything below is deployed. This was a huge day — the app went from
"demo-ready" to **NPS-go-to-market-ready**, and the business decided pricing +
the one-app/two-shapes architecture.

**The big architectural decision (read [FIELD-GUIDE.md](FIELD-GUIDE.md)):** ONE
app, no fork, no NPS branch. `districts.org_type ('district'|'nps')` is the
single source of truth (046). An NPS = an org with one school whose **director**
holds site_admin + district_admin. Devin's service-call protocol: name the
school/person and Claude routes from the DB; prefixes `NPS:` / `District:` /
`Kit:` (marketing) when no name.

**Product shipped today (chronological):**
- **Site-admin magic-link oversight (041, `46475f2`)** — `/admin/links` "Family
  links" tab: PII-blind school-wide link list (teacher + metadata, never student
  names) + confirm-to-revoke; `revoke_magic_link` now founder-capable + writes
  an audit row.
- **Scoped audit-read (`90fd5df`)** — `/admin/audit-log` serves founder (all),
  district admins (their district), site admins (their school); PII-table rows
  excluded from scoped views. Audit tab in SiteAdminNav.
- **Splash once per browser session (`0c72b70`)** — sessionStorage gate checked
  pre-paint; landing/dashboard loading states now use a cream `QuietLoader`
  instead of the navy splash.
- **Customize: editable zone names + quick-fill level (`453a8ee`)** — the four
  progress-zone labels are teacher-editable; ⚡ fills top/second/third scale
  option (3s/2s/1s). Co-teacher link renamed "Co-teacher / Paraprofessional"
  (view says "Classroom Team").
- **Founder per-district usage (042, `ff3fd54`)** — `/admin/usage` founder view:
  All-districts rollup + per-district chips (now with "· NPS" badges).
- **District notes archive (043, `45238ff`)** — `/admin/notes-archive`: ALL
  district notes (incl. private), reason-gated (≥10 chars), audit row written
  BEFORE rows return, CSV + print. **/privacy rewritten (`342dcf1`): the
  district plainly owns and can view its full record; PII-blindness is claimed
  ONLY for the Operator.** Counsel eyeball still wanted.
- **Student self-assess (044, `9b454a4`)** — student link generated with "Allow
  self-assessment" (readwrite) shows a "Rate your own day" panel; submissions
  land in separate `self_assessments` (teacher's record stays official).
  **Teacher sees self-checks** in the Entry view (`2105d09`).
- **Lunch hardcode removed + error boundary on palette (`2105d09`).**
- **Single-email invite (`dbf284b`) → branded short links (045, `d9a5311`)** —
  invites email ONE message with `dailywins.school/welcome/<code>` (12-char,
  single-use, 24h; `invite_signin_links` table). `/welcome` is a branded
  interstitial whose button POST does the verifyOtp — mail scanners can't burn
  the token. **OTP expiry raised 1h → 24h** (Supabase auth config via
  Management API; was 3600, now 86400).
- **Approval email closes the signup loop (`ba0ea71`)** — approving an access
  request emails the requester "You're approved" + welcome link (was: silence).
  Diagnosed from prod: the loop itself had worked; the email never existed.
- **org_type + one-step NPS provisioning (046, `a90c4d0`)** — approve modal has
  an **"NPS Director"** role: type the org name → atomic RPC creates org
  (org_type=nps) + school + grants site_admin & district_admin → approval email
  says "director".
- **NPS director login (047, `ad0c0bb`)** — `/admin/records` ("Student records"
  tab): roster → full per-student record (BehaviorCharts + ALL notes incl.
  private, teacher-attributed; each open audited `nps_record.student`).
  NPS-only: district site admins stay PII-blind and see an explanation;
  founders excluded (operator blindness). **Link policy:**
  `schools.link_settings` {parent,student,co_teacher} — director toggles on
  `/admin/links`, ENFORCED inside `generate_magic_link`; teacher's Manage Links
  hides disabled types. All guards smoke-tested on prod.

**Business decided today:**
- **Pricing:** $199/mo flat per school, unlimited teachers, billed annually
  ($2,388/yr); free 60-day pilot; **founding rate: first 15 California schools
  lock $149/mo for life.** Live on the marketing site + deck + demo script +
  emails + cost-structure doc.
- **Devin has a 260-school California NPS list** to start outreach this month.
- Marketing site live at **dailywins-schools.vercel.app** (Vercel project
  `dailywins-schools`, deployed from `dailywins-marketing/website/`).
  `dw.surestepeducation.com` still awaits a Cloudflare CNAME
  (`dw` → `cname.vercel-dns.com`, DNS-only).

**Local-only (this machine, NOT in git).** Firefox role profiles +
`DailyWins Roles.command`; `package.json` dev scripts stay UNCOMMITTED;
`dailywins-marketing/` and `DailyWins Docs 2026-06-10/` (doc snapshots for a
Claude project) live outside git.

**Test accounts (prod).** South Sac cluster (surestep2 district / devintest2
site_admin / devintest3 teacher @ proton.me) + surestep3@proton.me (approved
teacher, from signup-loop testing). devinfarren+dw* aliases. Founder = Devin's
Google in Chrome. **No NPS org exists yet** — first NPS-Director approval will
create one.

⚠️ **Open verification (deployed prod, browser):**
1. **NPS end-to-end walk** — sign up a fresh test email → approve as **NPS
   Director** (fake org) → approval email → welcome link → director dashboard →
   Student records tab (empty roster OK) → Link policy toggles → invite a
   teacher → teacher generates links (confirm a disabled type is hidden AND
   blocked).
2. **Self-assess walk** — readwrite student link → submit → teacher Entry view
   shows the self-checks card.
3. **Single-email invite + approval email** — both flows end in `/welcome/…`;
   eyeball the branded page.
4. Older: PDF bar charts B&W eyeball, arrival-fix eyeball, deactivate/reactivate
   walk, act-as schedule-edit live-verify.

**Known follow-ups:**
- **/privacy counsel eyeball** — district-record-ownership wording (342dcf1) +
  NPS director records access; the site-admin bullet already permits school-level
  record access, but a lawyer should read the whole §7 once.
- **Marketing launch:** Cloudflare CNAME for `dw.`; demo dry-run with Nick;
  first 25-school email batch (sequence in `dailywins-marketing/emails/`).
- **Tier-doc gaps (build when a multi-school org signs):** district-admin
  invites site-admins; non-teacher deactivate.
- **General audit gap** for direct admin/MCP SQL (session-variable actor).
- **One-way doors (attended):** drop vestigial `allowed_emails`; remove stale
  `claude/determined-black-d331b5` worktree+branch (draft snapshotted).
- Rose theme green secondary (cosmetic).

## What's queued next
1. **The NPS end-to-end walk above** — it's the exact flow the first paying
   director will experience; everything else is secondary.
2. **Marketing launch steps** (CNAME → dry-run → first email batch).
3. Counsel pass on /privacy §7.
4. Parking lot: tier-doc gaps, audit SQL gap, one-way-door cleanups.

## Working guardrails (current)
- **Reversibility gate:** reversible work proceeds (incl. backed-up prod
  writes); **snapshot before every prod mutation;** queue one-way doors for an
  attended + approved moment.
- Guarded-apply or stage-test migrations — restore point first, verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution; `effective_user_id()` for data access.
- Branch workflow in [ARCHITECTURE.md](ARCHITECTURE.md); service-call protocol
  + estate map in [FIELD-GUIDE.md](FIELD-GUIDE.md).
- **PII-blindness boundaries (post-047):** teachers → own students; NPS
  director → everything at their school (audited); district admins → aggregate
  + audited notes archive; site admins (district-shaped) → blind; Operator →
  blind (act-as + maintenance exceptions only).

## Infrastructure
- **Prod app:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Migration head:
  **`047`**. Vercel, three domains. OTP expiry now 86400s.
- **Marketing site:** Vercel project `dailywins-schools`
  (dailywins-schools.vercel.app) ← `dailywins-marketing/website/` via CLI
  (`npx vercel deploy --prod --yes` from that folder).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2), paused manually.
- **Company site:** surestepeducation.com = Netlify behind Cloudflare.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Overwrite the passphrase line whenever you want a fresh marker.
