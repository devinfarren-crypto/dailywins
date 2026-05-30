# Session Handoff

**Handoff passphrase: `coral-otter-lighthouse-30`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `coral-otter-lighthouse-30`, the repo is synced and Claude can see
> the full state below. (This file travels with git; the chat history and the
> local `~/.claude/.../memory/` files do **not** — everything you need is here
> and in [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-05-30

## Where things stand
`main` is clean and in sync with `origin/main`. Two features shipped this
session, both committed and pushed:

- **`9b35159` — Passwordless email magic-link sign-in.** Non-Google accounts
  (proton/outlook/etc.) can now join. Email field + "Email me a sign-in link"
  on the landing page ([app/page.tsx](app/page.tsx)) via `signInWithOtp`,
  routed through the same `/auth/callback` gate as Google → identical
  access-request approval + RLS. Verified live (non-Google email → `/pending`).
  Supabase prod auth config done (Email provider on, `localhost:3000/**`
  redirect added).
- **`bba4988` — Founder break-glass UI.** Founder-only `/admin/break-glass`
  page: any-role candidate list, confirmation modal with required reason +
  15-min hard-timeout warning, rose-red styling. Verified live.

## What's queued next (from ROADMAP "Open")
1. **Capture live-only fixes as migration files** — the task originally picked;
   pure local work, no prod writes. Good next step.
2. **Resend → Supabase custom SMTP** — only Devin can do (DNS + config). Now
   double-duty: fixes magic-link email delivery (currently the rate-limited
   built-in sender) *and* powers beta-access notifications.
3. Other open items: break-glass renewal/inactivity, audit triggers (v1.5),
   `teachers.preferences` staging/prod drift, migrations tracking drift,
   `allowed_emails` cleanup (vestigial). See [ROADMAP.md](ROADMAP.md).

## Working guardrails (carried)
- Read prod freely; **never** autonomously write prod schema/data — propose it.
- Stage-test, then commit migrations.
- A passing type-check is not a working feature — close the loop in the browser.
- Commit messages: clean, no Claude attribution trailers.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Delete or overwrite this file's passphrase line whenever you want a
fresh handoff marker.
