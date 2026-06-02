# Session Handoff

**Handoff passphrase: `cobalt-heron-sextant-58`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `cobalt-heron-sextant-58`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-02 (midday)

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `032`.**
Phases 4/5/6 are all shipped + live-verified. Focus shifted to **EGUSD July 13
demo prep** — Devin is building a separate "Demo Project" covering both tools
(DailyWins + Transition Ready), the privacy posture, and the **CA Gov Code §1090
constraint** ("can't accept money" → free-pilot framing; needs counsel). A full
**DailyWins demo briefing** was handed to Devin to paste into that project (it
lives in chat, not the repo). This session shipped:

- **Resend setup checklist — [docs/RESEND_SETUP.md](docs/RESEND_SETUP.md)** (6/02).
  Verified the code path (`notify-new-access-request.ts` → `auth/callback`,
  `resend@^6.12.4` installed, no-ops until configured). Checklist covers DNS
  verification, the 3 Vercel env vars (founder notifications), and Supabase
  custom SMTP (magic-link delivery). **Devin's to action** — the one true
  tester-growth blocker.

- **Demo data verified healthy (6/02), no reseed done.** The "all-zero" bug is
  already fixed in the live data (phoneAway non-zero 1366/1590, onTask
  1586/1590) and it's only ~4 days stale. Reseed for date-freshness right before
  the demo via Demo Mode → Wipe → Seed (or ask Claude to script it). Confirm the
  dashboard *renders* it right during a dry-run.

- **`/privacy` refresh (merged → live).** The policy now matches the shipped
  security architecture: RLS at the DB layer, four-tier model with the
  Operator + District-Admin PII-blindness (**verified against live RLS
  policies** — they appear in none of the PII read policies), audited/transparent
  act-as, magic-link auth, the parent read-only link, and Anthropic as a
  schedule-parsing subprocessor. ⚠️ Two items want sign-off (revisable any
  time): confirm exact data-residency region (de-specified "Ohio"→"US East"
  since prod is us-east-1), and counsel eyeball on the PII-blindness + Anthropic
  "not used to train" wording.

- **`/privacy` refresh (merged → live).** The policy now matches the shipped
  security architecture: RLS at the DB layer, four-tier model with the
  Operator + District-Admin PII-blindness (**verified against live RLS
  policies** — they appear in none of the PII read policies), audited/transparent
  act-as, magic-link auth, the parent read-only link, and Anthropic as a
  schedule-parsing subprocessor. ⚠️ Two items want sign-off (revisable any
  time): confirm exact data-residency region (de-specified "Ohio"→"US East"
  since prod is us-east-1), and counsel eyeball on the PII-blindness + Anthropic
  "not used to train" wording.

- **Phase 4 audit expansion (migration 032, applied + verified in prod).**
  Extended the generic 029 trigger to `role_assignments`, `school_admins`,
  `schools`, `districts` (alias map only; 029 tables unchanged) → 21 triggers.
  Schedule edits go through the service-role client, so the schools trigger
  no-ops on them; they're audited app-side via `writeAuditLog('schedule.update')`
  in `app/api/schedule/save`. Guarded apply: captured the prior function def as
  a restore point, verified triggers attached + no 029 regression + ledger
  recorded, and ran a **rolled-back** behavioral test proving a new trigger
  fires with correct actor attribution (zero residue).

- **Governance change — the reversibility gate replaced "never write prod."**
  Old rule was a poor proxy for "prevent irreversible damage." New rule keys on
  reversibility: do anything reversible (incl. backed-up prod writes — always
  snapshot first); queue genuine one-way doors. The cosmetic "no Claude
  attribution in commits" rule was **dropped** (trailers are fine now). Both
  recorded in `~/.claude/.../memory/`.

## What's queued next (from ROADMAP "Open" + recommended order)
1. **Resend setup** — only Devin can do (DNS + Vercel env + Supabase SMTP).
   Follow **[docs/RESEND_SETUP.md](docs/RESEND_SETUP.md)**; Step 1 (DNS) is the
   slow part, so start early. The real blocker on adding testers.
2. **EGUSD demo plan** — Devin building it in a separate project (DW + Transition
   Ready + privacy + §1090). DW briefing already delivered. Claude can still
   draft a DW demo clickpath on request.
3. **Quick code follow-ups** (small, reversible, doable attended): founder-
   implicit schedule-edit access (P6); act-as attribution on the
   `schedule.update` audit (P4 parity).
4. **Operational:** inactivity-based `expires_at` renewal; demo-mode wipe+reseed.
5. **Decide:** whether the `school_schedules` table (~10h) is still worth it now
   that JSONB + the editor solve it.
6. **Cleanup (one-way doors — snapshot first):** drop vestigial `allowed_emails`.

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
