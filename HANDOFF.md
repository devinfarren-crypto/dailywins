# Session Handoff

**Handoff passphrase: `amber-falcon-lantern-37`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `amber-falcon-lantern-37`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-03 (evening)

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `032`**
(no migrations this session — all app/config changes). Phases 4/5/6 shipped +
live-verified. **The big win this session: email is live and magic links now
work cross-device — the tester-growth blocker is fully cleared.** Two commits
shipped to prod (`73aef2c`, `aca6bfc`), both Vercel-deployed and verified.

- **Resend / email is LIVE.** Domain `send.dailywins.school` verified at GoDaddy
  (DKIM/SPF/MX/DMARC all resolving). Vercel env: `RESEND_API_KEY`,
  `NOTIFY_FROM_EMAIL` (`DailyWins <noreply@send.dailywins.school>`),
  `NOTIFY_TO_EMAIL` → **`devinfarren@gmail.com`** (the surestep mailbox isn't
  bridged to Gmail, so alerts go straight to the inbox Devin reads). Supabase
  custom SMTP wired (smtp.resend.com:465, user `resend`); email rate limit
  bumped 30→100/hr. Both founder-notification and magic-link delivery confirmed
  in Resend logs. ⚠️ New domain → first sends land in **Spam/Promotions** until
  reputation warms; mark "Not spam" on the early ones.

- **Cross-device magic links FIXED (`73aef2c`).** The bug: magic-link sign-in
  used PKCE (`exchangeCodeForSession` needs the requesting browser's
  `code_verifier` cookie), so clicking the link on a different device/browser
  failed silently (`email_confirmed_at` set, `last_sign_in_at` null, no
  access-request row, no notification). Fix: new **`/auth/confirm`** route uses
  `verifyOtp({ token_hash })` — no cookie, works cross-device — plus a `?code=`
  fallback. Shared provisioning gate extracted to **`src/lib/auth-provision.ts`**
  (both `/auth/callback` OAuth and `/auth/confirm` email call it). Email
  templates flipped to the `token_hash` URL. **Proven in prod** via an incognito
  (cross-context) test: `last_sign_in_at` finally non-null, row + Gmail alert
  landed.

- **`/pending` hardened (`aca6bfc`).** Was an ungated client page (unauth
  visitors saw the shell; the `/api/access-request/mine` fetch 401'd → "Unable
  to load your request status"). Now a server component that `getUser()`s and
  redirects (no session → `/`, approved → `/dashboard`, denied/missing →
  `/access-denied`, pending → render with status/school as props). Dead
  `/api/access-request/mine` route removed. Verified: unauth `/pending` → 307
  `/`; mine → 404.

EGUSD July 13 prep is otherwise unchanged — Devin's separate "Demo Project"
(DW + Transition Ready + privacy + §1090 free-pilot framing) and the DW demo
clickpath are still the headline remaining work. The `/privacy` sign-off items
(data-residency region; counsel eyeball on PII-blindness + Anthropic wording)
also still stand.

## What's queued next (from ROADMAP "Open" + recommended order)
1. **Flip the "Magic Link" email template** — *unverified; likely not done.* The
   "Confirm signup" template IS flipped (proven by the cross-device test). The
   "Magic Link" template (existing users re-requesting a link) needs the same
   edit: Supabase → Auth → Emails → Templates → **Magic Link** → set the href to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`.
   30-sec dashboard job; can't be read remotely. Low-stakes (the `?code=`
   fallback keeps existing-user links working same-device; the flip closes the
   existing-user cross-device gap).
2. **Clean up test accounts** — ~9 `devintest*@proton.me` / `devintest3@proton.me`
   rows in `auth.users` + `access_requests` from today's testing. Safe scoped
   delete; left in place pending Devin's OK (asked, not yet answered).
3. **EGUSD demo plan** — Devin building it in a separate project. DW briefing
   delivered. Claude can draft a DW demo clickpath on request.
4. **Quick code follow-ups:** founder-implicit schedule-edit access (P6); act-as
   attribution on the `schedule.update` audit (P4 parity).
5. **Operational:** inactivity-based `expires_at` renewal; demo-mode wipe+reseed.
6. **Decide:** whether the `school_schedules` table (~10h) still earns its cost.
7. **Cleanup (one-way doors — snapshot first):** drop vestigial `allowed_emails`.

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
  three domains. Migration head: **`032`**. Supabase MCP pinned to prod via an
  `sbp_…` PAT in `~/.claude.json` (no dev branches; staging is a separate,
  MCP-unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to
  save the t4g.nano cost.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Overwrite the passphrase line whenever you want a fresh marker.
