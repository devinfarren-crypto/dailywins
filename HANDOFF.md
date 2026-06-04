# Session Handoff

**Handoff passphrase: `cobalt-otter-meadow-52`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `amber-falcon-lantern-37`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-04

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `032`**
(no migrations this session — app code + a prod data cleanup only). The three
queued Phase 4/5/6 follow-ups shipped to prod in one merge (`659a73a`,
Vercel-deployed; branch deleted):

- **Founder-implicit schedule edit (P6).** A founder can now manage any
  school's bell schedule without an explicit `school_admins` row.
  `/admin/upload-schedule` loads every school for founders; the save route
  ([app/api/schedule/save/route.ts](app/api/schedule/save/route.ts)) falls back
  to `has_role('founder')` when `is_school_admin()` fails. Both resolve through
  `effective_user_id()`, so an active act-as session still scopes to the target.
  Unblocks the "founder onboards a 3rd school" story.

- **Act-as attribution on the `schedule.update` audit (P4 parity).** The
  app-layer audit now stamps `acting_as_user_id` + `break_glass` via
  `getCurrentActAsSession()`, matching the DB triggers. Previously a schedule
  edit made under act-as lost the impersonation trail.

- **Inactivity-based act-as expiry.** `getCurrentActAsSession()`
  ([src/lib/act-as-current.ts](src/lib/act-as-current.ts)) now slides a regular
  session's `expires_at` forward on activity (throttled to one write / 5 min)
  so a long support call isn't cut off at a hard 60 min from start. Break-glass
  stays hard-capped for safety and is never extended.

Two housekeeping wins closed the magic-link saga and the test-account clutter:

- **"Magic Link" email template flipped (Devin, this session).** The last
  open auth item. Existing-user cross-device re-request links now work — the
  magic-link gap is fully closed (both Confirm-signup and Magic Link templates
  point at `/auth/confirm?token_hash=…`).

- **~9 `devintest*@proton.me` test accounts deleted** (scoped prod delete,
  snapshot at `.snapshots/2026-06-04-devintest-accounts-predelete.json`, which
  is gitignored). Removed 9 `auth.users` + 3 `access_requests`; the lone test
  teacher/role (devintest2, 0 behavior rows) cascaded. Verified: 0 residue, 6
  real users remain, 3 founders intact.

⚠️ **Live-verification gap:** build + typecheck pass on the three code changes,
but the act-as items (#2 founder path, #3 attribution, #4 sliding expiry) only
fully exercise *under an active act-as session* — not yet walked end-to-end in
prod. The clean test: start an act-as session → edit a schedule → confirm the
audit row carries `acting_as_user_id` and that `expires_at` slides on activity.

EGUSD July 13 prep is the headline remaining work — Devin is building the demo
in a separate "Demo Project" (DW + Transition Ready + privacy + §1090
free-pilot framing). The `/privacy` sign-off items (data-residency region;
counsel eyeball on PII-blindness + Anthropic wording) and the compliance/DPA
folder also still stand.

## What's queued next (from ROADMAP "Open" + recommended order)
1. **EGUSD demo script** — Devin is building it in a separate project; it's the
   highest-leverage July 13 item. Claude can draft a DW demo clickpath on
   request (approve-under-audit → act-as → coral banner → audit-log → break-glass).
2. **General audit gap for direct admin/MCP SQL** — the 029 trigger no-ops on
   service-role context (`auth.uid()` NULL). 032 + this session closed it for
   *schedule* edits app-side; arbitrary admin SQL still wants a session-variable
   "intended actor" so the trigger can attribute to a real user.
3. **Decide:** whether the `school_schedules` table (~10h) still earns its cost
   (the JSONB-on-`schools` column + the editor already solved the practical
   problem).
4. **Cleanup (one-way door — snapshot first):** drop vestigial `allowed_emails`.
5. **`/privacy` sign-off + compliance folder:** confirm data-residency region
   (prod is us-east-1), counsel eyeball on PII-blindness + Anthropic wording,
   assemble DPA templates (CSDPA / National DPA).
6. **Operational:** demo-mode wipe+reseed for date-freshness before a dry-run.

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
