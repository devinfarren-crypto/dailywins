# Session Handoff

**Handoff passphrase: `pewter-marlin-sextant-07`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `pewter-marlin-sextant-07`, the repo is synced and Claude can see
> the full state below. (This file travels with git; the chat history and the
> local `~/.claude/.../memory/` files do **not** — everything you need is here
> and in [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-05-30 (evening — `sync` convention added)

## Where things stand
`main` is clean and in sync with `origin/main`. Latest commit `5a83030` adds
the `sync` convention to [CLAUDE.md](CLAUDE.md) — when you type `sync` on
either machine, Claude refreshes HANDOFF + ROADMAP and pushes. Otherwise
no functional code changes since the prior afternoon handoff. The shipped
work that's still load-bearing:

- **`6f40bc7` — Phase 4 audit triggers (migration 029).** Postgres triggers
  on `behavior_scores` / `notes` / `students` write `audit_log` rows for every
  INSERT/UPDATE/DELETE. No-op when `auth.uid()` is NULL (service-role writes
  remain caller-audited via `writeAuditLog`). Closes the "determined teacher
  could bypass `fireAuditEvent`" gap from the prior ROADMAP. Staging-verified
  with 4 cases (regular teacher / act-as / service-role no-op / break-glass),
  prod-applied + validated under unscripted load by a Chrome Claude agent
  session that the triggers captured cleanly in 35 audit rows.
- **`54d48a1` — `teachers.preferences` (migration 030) + "Show Period 0"
  toggle + BELL_SCHEDULES purge.** Three coupled changes:
  1. Migration 030 adds `teachers.preferences jsonb DEFAULT '{}'` to prod
     (closes the staging/prod drift). Every Customize toggle — theme, font,
     confetti, compact, and the new Show Period 0 — now round-trips across
     sign-out / sign-in. Dashboard read path SELECTs the column too.
  2. New "Show Period 0" toggle in Customize. Period 0 is the before-school
     prep block; in real teaching it's almost never scored, so it's hidden
     by default and a teacher opts in if they actually have a 0-period
     class. Filter is one line in `trackablePeriods`.
  3. `BELL_SCHEDULES` const in DashboardClient.tsx reduced from ~140 lines
     to `{}`. `schools.schedules` JSONB is the source of truth and the
     hardcoded fallback had diverged (missing Period 0, lunch break
     entries, Monday Period 4). An empty fallback shows nothing on
     cold-load / DB-failure instead of misleading stale data.

Migration-tracking drift also got smaller this session: 14 catch-up migrations
(014–028) applied to staging so it now mirrors prod for the migrations recorded
in its history. Prod's `schema_migrations` head is now `030_teachers_preferences`.

## What's queued next (from ROADMAP "Open")
1. **Resend → Supabase custom SMTP** — only Devin can do (DNS + config).
   Unblocks magic-link email delivery (currently the rate-limited built-in
   sender) and powers beta-access notifications. Code is dormant and ready.
2. **`/privacy` page refresh** — the EGUSD pitch's "vendor can't see student
   data" claim is now structurally true (RLS + 029 audit triggers + 028
   PII rewrite). The privacy page still talks like that claim is aspirational.
3. **Demo script for EGUSD July 13** — center on the four-tier model + the
   audit-log artifact. Not started.
4. **Investigate "Tommy at PGHS"** — listed as a pilot teacher in ROADMAP
   but absent from `public.teachers`. Either re-provision him or drop him
   from the pilot status.
5. **`school_schedules` admin UI** — promoted to "before July 13"; lets a
   Site Admin maintain the per-school JSONB without Founder involvement.

Smaller items in [ROADMAP.md](ROADMAP.md): inactivity-based renewal,
break-glass UX polish, `allowed_emails` drop, captured-but-not-yet-deleted
notes audit gap (service-role MCP cleanups bypass the trigger by design —
chat log is the trail).

## Working guardrails (carried)
- Read prod freely; **never** autonomously write prod schema/data — propose it.
- Stage-test, then commit migrations.
- A passing type-check is not a working feature — close the loop in the browser.
- Commit messages: clean, no Claude attribution trailers.
- `auth.uid()` for attribution; `effective_user_id()` for data access. Don't mix.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel one project,
  three domains. Migrations head: `030_teachers_preferences`.
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). **Active** as of
  this handoff (was paused before today's catch-up). Re-pause manually if you
  want to save the t4g.nano cost — restoring takes a few minutes.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Delete or overwrite this file's passphrase line whenever you want
a fresh handoff marker.
