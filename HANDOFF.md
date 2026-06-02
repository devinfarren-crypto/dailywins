# Session Handoff

**Handoff passphrase: `amber-tern-quadrant-33`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `amber-tern-quadrant-33`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-02 (morning)

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `032`.**
Phases 4/5/6 are all shipped + live-verified. Since the 6/01 handoff, this
session shipped:

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
1. **Resend → Supabase custom SMTP** — only Devin can do (DNS + Vercel env).
   The real blocker on adding testers; unblocks magic-link delivery + beta
   notifications. Code dormant and ready.
2. **EGUSD demo script** — highest-leverage July 13 item; four-tier model +
   act-as + the audit-log artifact + break-glass as the visual proof.
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
