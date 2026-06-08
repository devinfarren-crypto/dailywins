# Session Handoff

**Handoff passphrase: `marigold-heron-quartz-63`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `amber-falcon-lantern-37`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md).)

Last handoff: 2026-06-08

## Where things stand
`main` is clean and in sync with `origin/main`. **Prod migration head: `033`**
(migration 033 applied to prod this session, user-authorized). Two big features
shipped to prod this session, each its own merge (Vercel-deployed):

**1. Sure Step Education design system (`966160b`).** Adopted the cross-surface
design system (`sure-step-design-system.md`) — editorial serif **Fraunces** +
accessible **Public Sans** + **IBM Plex Mono** eyebrows, warm paper/ink palette,
single green signature accent, amber highlight, coral reserved for status.
- [app/layout.tsx](app/layout.tsx): next/font trio as `--ssd-font-*` vars (the
  leftover create-next-app Geist is gone); ink `theme-color`.
- [app/globals.css](app/globals.css): full token set mapped into Tailwind v4
  `@theme`; `.ssd-eyebrow` / `.ssd-nav`; green focus ring + reduced-motion (§10).
- Landing/login restyled. Dashboard: repointed the `COLORS` constants + the
  `default` theme to design tokens (cascades the ~126 direct usages); the
  standing zones (`red/gold/green/blue`) now map onto the §2 **status scale**.
  Original palette preserved as a selectable **"Classic DailyWins"** theme;
  Public Sans + Fraunces added to the font switcher (Public Sans default).

**2. All-perspectives: admin on-ramp + student/co-teacher links (`fe3c2a9`).**
Closes the gaps that made some roles un-walkable. Prereq discovery: ~126 dashboard
elements read hardcoded `COLORS` (not the theme); only founder+teacher+parent were
truly walkable; **no site_admin / district_admin accounts existed**, and student/
co-teacher had backend funcs but no routes.
- **migration 033 `approve_access_request_as_role(request, role, school?, district?)`**
  — founder can now provision an approved request as teacher / site_admin /
  district_admin with the right scope. 023's teacher-only RPC left intact.
- `/api/admin/approve` accepts role+scope (defaults to teacher → unchanged
  behavior); new `/api/admin/districts`; approval modal gained a role + scope picker.
- **Admin landing fix** ([src/lib/auth-provision.ts](src/lib/auth-provision.ts)):
  a pure admin (role, no teachers row) lands on `/admin/teachers` instead of
  bouncing to `/pending` via the dashboard's `ensure_teacher_exists`. Also fixes
  the latent bug for the no-teacher-row founder account.
- **Student + co-teacher views**: new `/student/[token]` + `/coteacher/[token]`
  on a shared [MagicLinkSummary](src/components/MagicLinkSummary.tsx) (parent page
  refactored onto it). [ManageLinksModal](src/components/ManageLinksModal.tsx) now
  generates parent / student / co-teacher links (co-teacher read-write toggle).

Topology confirmed for testing: 2 districts (Elk Grove Unified = PGHS+COHS,
Sacramento = Sac HS), PGHS is the richest target (12 students, Devin as teacher).

⚠️ **Open verification:** Devin walked the perspectives locally (dev server →
prod DB) and approved it for ship; a fresh end-to-end pass on the *deployed* prod
app (create the 3 +alias test accounts → approve each role → log in) is the clean
confirmation. Test accounts were NOT created yet — that's Devin's browser step
(magic-link to `devinfarren+dw…@gmail.com` aliases). The older act-as
schedule-edit live-verify (founder path / attribution / sliding expiry) also
still stands as a discrete check.

EGUSD July 13 prep remains the business headline (separate Demo Project). The
`/privacy` sign-off items and compliance/DPA folder still stand. **This chat's
scope is the DailyWins product + walking every perspective — not the demo/business.**

## What's queued next (product-focused; from ROADMAP "Open")
1. **Create the +alias test accounts & walk all six perspectives on deployed prod**
   — teacher@PGHS, site_admin@PGHS, district_admin@Elk Grove Unified; plus
   parent + student links from the dashboard. Confirms the on-ramp end-to-end.
2. **Co-teacher write path UI** — backend `coteacher_write_score/note` exist and
   the read view ships; the in-page write affordance (readwrite links) is not
   built. Optional polish.
3. **General audit gap for direct admin/MCP SQL** — 029 trigger no-ops on
   service-role context; wants a session-variable "intended actor."
4. **Decide:** whether the `school_schedules` table (~10h) still earns its cost.
5. **Cleanup (one-way door — snapshot first):** drop vestigial `allowed_emails`.
6. **Design-system follow-through (optional):** button solid/ghost hierarchy,
   Recharts palette ([ChartViews.tsx](app/dashboard/ChartViews.tsx)), modals,
   retire emoji/confetti per the design doc; standardize "DailyWins" vs "Daily Wins".

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
  three domains. Migration head: **`033`**. Supabase MCP pinned to prod via an
  `sbp_…` PAT in `~/.claude.json` (no dev branches; staging is a separate,
  MCP-unreachable project).
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2). Pause manually to
  save the t4g.nano cost.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Overwrite the passphrase line whenever you want a fresh marker.
