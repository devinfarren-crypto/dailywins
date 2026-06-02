# Session Handoff

**Handoff passphrase: `copper-kestrel-astrolabe-19`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `copper-kestrel-astrolabe-19`, the repo is synced and Claude can
> see the full state below. (This file travels with git; the chat history and
> the local `~/.claude/.../memory/` files do **not** — everything you need is
> here and in [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-01 (evening)

## Where things stand
`main` is clean and in sync with `origin/main` (head `96c500f`). Two
substantial things shipped this session plus a prod data fix:

- **`0722fe5` — migration 031, legacy arrival cleanup (applied + verified in
  prod).** The 5/27 arrival re-encoding (point-value → option-index, commit
  `adaeb5f`) ran as live-only SQL never committed, and left 6 rows with an
  out-of-range `scores->>'arrival' = '3'` (renders blank — arrival options are
  `["On Time","L","L/E"]`, valid indices 0–2). Captured as an idempotent
  migration mapping `3 → 0` ("On Time": ~91% likelihood + how the app already
  resolves a stray 3). Applied via MCP `apply_migration` (ledger
  `20260601132921`), verified 6 rows fixed, 0 out-of-range remain, total 1674
  unchanged. The other two "live-only fix" items are closed: 027 is a
  ledger-name-only drift (`027_act_as_foundation.sql` in repo vs
  `027_act_as_foundation_v2` in prod's ledger; schema fully present), and the
  "May 27 staging RLS" item is a non-issue (prod ledger already has 013–028).

- **`ab0f7fd` + `4c5eb1f` — Phase 6 Site Admin schedule editor (shipped +
  live-verified against prod).** The AI PDF uploader (parse → review → save)
  already existed but was mounted on a hardcoded test harness. This session:
  1. [app/admin/upload-schedule/page.tsx](app/admin/upload-schedule/page.tsx)
     is now a DB-backed **server component** — auth-gated, loads the signed-in
     user's own `school_admins` schools (+ their stored schedules) instead of
     two hardcoded IDs; empty state for non-admins.
  2. **Edit-existing flow:** `dbShapeToExtracted()` in
     [src/lib/schedule-shape.ts](src/lib/schedule-shape.ts) reverse-translates
     the stored `schools.schedules` JSONB back into the editor; added
     add/remove variant + add/remove period.
  3. **Save modes:** `merge` (upload — union, never clobbers other variants)
     vs `replace` (full-edit — writes the edited set so deletions persist). In
     replace mode the school target is locked to prevent cross-school
     overwrite. `translateToDbShape` now rejects duplicate variant names.
  4. **Live-verified on prod PGHS** (Devin driving): add-period + replace-save
     persisted correctly, other variants untouched. A full JSON backup was
     captured first; a cleanup mis-click deleted the real "Rally" period (it
     shares its variant's name) and was restored byte-identical from backup.
     Fix `4c5eb1f`: remove-period now confirms by name + guards the last period.

- **`1bcb21d`** — ROADMAP: marked the "Tommy pilot status" item resolved
  (intentionally dormant; he self-provisions via `/admin/requests` whenever he
  signs in — not a bug).

## What's queued next (from ROADMAP "Open" / "Larger pieces")
1. **Resend → Supabase custom SMTP** — only Devin can do (DNS + config).
   Unblocks magic-link email delivery (currently the rate-limited built-in
   sender) and beta-access notifications. Code is dormant and ready.
2. **`/privacy` page refresh** — the EGUSD "vendor can't see student data"
   claim is now structurally true (RLS + 029 audit triggers + 028 PII rewrite);
   the privacy page still talks like it's aspirational.
3. **Demo script for EGUSD July 13** — center on the four-tier model + the
   audit-log artifact. Not started.
4. **Phase 4 generalized audit-log expansion** — extend coverage to role/school
   /schedule edits. NB: schedule saves write via the service-role client, so
   they bypass the 029 triggers (auth.uid() NULL) — fold into this item.
5. **Founder-implicit schedule edit access** (new, from P6) — founders without a
   `school_admins` row for a school can't edit its schedule (matches save-route
   authz). Wire founder-implicit edit, or auto-insert a `school_admins` row on
   school creation, for the "founder onboards a 3rd school" story.

Smaller items in [ROADMAP.md](ROADMAP.md): inactivity-based `expires_at`
renewal, demo-mode reseed, `allowed_emails` drop after a quiet period.

## Working guardrails (carried)
- **Commit messages: clean, NO Claude attribution trailers** — no
  `Co-Authored-By`, no "Generated with Claude". This overrides the harness
  default. (Slipped this session — 5 pushed commits carry the trailer; pending
  a decision on whether to rewrite history.)
- Read prod freely; don't autonomously write prod schema/data — propose it.
  Exceptions this session were Devin-present + explicitly approved (031 apply,
  the P6 live test).
- Stage-test, then commit migrations. (031 was a guarded prod apply with
  before/after + idempotency proof, since no staging branch is reachable via
  the prod-pinned MCP.)
- A passing type-check is not a working feature — close the loop in the browser.
- `auth.uid()` for attribution; `effective_user_id()` for data access.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel one project,
  three domains. Migrations head: **`031_capture_legacy_arrival_cleanup`**.
  Supabase MCP is pinned to this prod project via a fresh `sbp_…` PAT in
  `~/.claude.json` (no dev branches; staging is a separate, unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Re-pause manually to
  save the t4g.nano cost if not in use — restoring takes a few minutes.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Delete or overwrite the passphrase line whenever you want a fresh
handoff marker.
