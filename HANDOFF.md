# Session Handoff

**Handoff passphrase: `copper-locker-hinge-4`**

> Cross-machine continuity check: on another computer, `git pull`, open this
> project in Claude Code, and ask *"what's the handoff passphrase?"* If Claude
> reads back `copper-locker-hinge-4`, the repo is synced and Claude can see the
> full state below. (This file travels with git; the chat history and the local
> `~/.claude/.../memory/` files do **not** — everything you need is here and in
> [ROADMAP.md](ROADMAP.md) / [CLAUDE.md](CLAUDE.md) / [FIELD-GUIDE.md](FIELD-GUIDE.md).)

Last handoff: 2026-06-13

## Where things stand
`main` is clean and in sync with `origin/main` (only the intentionally
uncommitted `package.json` dev scripts are dirty). **Prod migration head:
`055`** (no DB changes this session). Everything below is deployed.

**6/13 — design polish + sales playbook day (no migrations).** Four code
commits + two reusable sales docs:
- **Splash, whole new direction.** The old navy "Sure Step Education" splash
  read corporate; replaced. Now: a once-per-session **playful front door**
  (warm cream, bars spring up with a bounce, amber growth-curve sweeps in,
  "DailyWins" pops, tiny confetti) in [Splash.tsx](src/components/Splash.tsx),
  and ONE calm cream loader for every other wait (breathing mark + teal
  shimmer) in [QuietLoader.tsx](src/components/QuietLoader.tsx). Both on cream,
  so loads never jump big-takeover→tiny-spinner — and it now matches the PWA
  manifest's cream launch. Standalone prototypes live at
  `~/Desktop/splash-concepts/` (3 directions; #1 + #3 shipped).
- **Locker opening, unified.** Two real bugs: (1) the splash *bled* onto
  /locker on refresh — SplashGate suppressed it in an effect, so it still
  SSR'd and animated a frame before hydration; now it reads `usePathname`
  during render so it never enters the markup. (2) the door was three
  unrelated objects (narrow 8/22 right-hinge swing → replaced by a wide 15/11
  left-hinge open locker = a size+hinge+direction jump). Now it's ONE cover on
  the open-locker canvas that swings open on the real LEFT hinge to reveal the
  same locker behind it. `lkShut`/`lkSwingOpen` + the separate closed view are
  gone. **Not yet eyeballed in the running app — Devin to verify on laptop.**
- **Navy field lightened.** `#1a1a2e` was doing double duty as splash/field
  navy AND body-text ink; a full-viewport navy field read near-black. Split:
  new `--ssd-navy: #252a4a` (+ `COLORS.navy` in the dashboard) for dark
  *fields/bands* (splash, header band, PERIOD/Entry/notes bands, demo);
  `--ssd-ink`/`COLORS.dark` stay `#1a1a2e` for text contrast. Canonical
  [Sure_Step_Education_Aesthetic.md](Sure_Step_Education_Aesthetic.md) updated.
- **Reusable sales playbooks** on Desktop (NOT in repo): `Sales 6-13.md`
  (no-gift pure-product) and `Sales 6-13 with refresh.md` (free homepage
  rebuild gift). Encode the approved Summa-style letter, the gift:false vs
  outreachHtmlProduct switch, the §1090/EGUSD stop, CAN-SPAM checklist, and
  the "research & quote the school's real mission" step.

**6/11 pm–6/12 was the hardening sweep, the compliance packet, and The
Locker** — from empty planning docs to a fully decorated student locker with
seven sticker packs, four functional cards, a wallet economy, and a teacher
reward shelf, in roughly a day. (Detail below is still current.)

**Director-console hardening (migrations 049–052, all applied):**
- **049 student soft-delete** — teacher hard-DELETE policy dropped (it
  cascaded a legal record); teachers archive (`archived_at`, audited,
  reversible); director roster badges archived students "record retained".
- **050 per-teacher categories** — `nps_get_student_record` returns
  `teacher_id` per row + `categories_by_teacher`; charts/PDF score each row
  against ITS teacher's config. Arrival 0% fixed (DB-default categories lack
  pointValues → derived like the dashboard).
- **051 usage hygiene** — `admin_first` demo-teacher rows, [DEMO] students,
  and archived students excluded from usage counts.
- **052 `schools.launch_finished_at`** — launch wizard completion is
  server-side, any device lands on mission control.
- Plus: student-record **Print PDF rebuilt** (navy header, vertical
  weekly/monthly bar charts, notes with SHARED/PRIVATE badges, audited
  `nps_record.print`, date-range picker); audit-log PII filter now passes
  `nps_record.*` rows (the "we log every record open" promise is actually
  visible to the director); org-aware privacy copy.

**Compliance packet (docs/compliance/ + ~/Desktop/compliance/ as PDFs):**
data inventory, subprocessor list, security summary, breach-notification
commitment, NDPA Exhibit B worksheet, EGUSD privacy-officer outreach email.
Playbook in [docs/CSDPA-REGISTRATION.md](docs/CSDPA-REGISTRATION.md) — no
agency exists; one originating LEA (EGUSD is the natural one) signs
NDPA+CA exhibits incl. Exhibit E, then SDPC registry posting.

**The Locker (migrations 053–055, catalog v5, all live at /locker):**
- **Architecture:** `students.canonical_id` (school-wide identity),
  `locker_identities` (combo slips + device claim via `dw_locker` httpOnly
  cookie), `points_ledger` (append-only, DB trigger blocks even service-role
  edits; daily-earn idempotency guard), `student_inventory`, `locker_layouts`
  (JSONB, 40-item cap = 054), `locker_purchase()` RPC (advisory lock),
  `shelf_items` (055, teacher shelf state machine). RLS on, ZERO policies —
  server routes only. Decisions log: docs/locker/decisions-2026-06-12.md.
- **Access:** teacher activates on /locker/manage (combo slips print sheet,
  class link `/locker/c/[code]`); student spins the combo once; the device
  stays claimed. Lazy daily earn mints settled days at the class rate
  (0.5–2×, the only economy lever); 100-pt welcome grant; spending NEVER
  touches behavior_scores.
- **The canvas:** one viewport, whole OPEN locker (door + cavity), drag /
  layer / rotate / resize, juice animations, foil/holo sheen. Entry ritual
  (rebuilt 6/13) = a door COVER on the open-locker canvas (same size, same
  place) that swings open on the real LEFT hinge in 1.15s to reveal the locker
  behind it — one object, no size/hinge jump. Top bar + controls fade in once
  open; the canvas never shifts. Fresh-from-combo auto-swings (dial snaps green
  → "Unlocked." → /locker). Exit = Shut chip. Splash never shows on /locker
  (now enforced at SSR via usePathname); no logos in the student path.
- **Seven packs, 98 catalog items:** Classics, Arcade (Bitt), Mixtape (Demi),
  Side Quest (Glorp), Kickflip (Curb), Cryptid Club (Sasquish), Y2K (Disco),
  Varsity (Champ). All original SVG via scripts/generate-locker-art.mjs,
  copyright rule "evoke the genre, never the franchise" (self-audit table in
  docs/locker/sticker-packs.md). Rarity = price + visual treatment ONLY.
- **Functional cards (free, lazily granted to everyone):** Goal card
  (category + 60–100% target picker, target tick on the bar, GOAL MET
  state), **My Best Work** (∞ refills — each placed card holds its own
  Google Doc/Slides link; https + host allowlist re-checked server-side per
  card; preset captions only), **Month card** (tap-to-cycle ✓ done /
  no-school / clear; weekends auto-tint; bounded marks record). The Today
  card was built then **retired same day** (Devin's call — Month replaced it;
  placed copies strip on load).
- **Teacher shelf (055):** /locker/manage grants hw-pass / late-pass /
  snack-coupon / front-of-line / shoutout / custom to student(s) or all;
  objects sit ON the cavity shelf (glow once when new); student taps "Use
  this" → pending; teacher Confirm / Not yet at the top of manage; REDEEMED
  stamp 5 days then auto-archive. Audited `locker.shelf_grant`/`shelf_redeem`.
  Ledger untouched (grants, not points).
- **Concurrency hardening (two real bugs found live):** (1) optimistic
  concurrency on layout saves — stale tab gets 409 + reload instead of
  clobbering (a multi-tab session ate Ava's decorated door); (2) saves are
  **chained** — rapid edits (calendar taps) raced the debounced save into a
  same-tab 409 that ate the newest marks ("green days don't stay green",
  fixed 6/12).

**Ops notes:** art is reviewed by rendered contact sheet (Chrome headless →
PNG → eyeball) before shipping — this caught the bad joystick, broken-looking
headphones, and a too-plain Chrome Sparkle. The full pack costs ~2,500 pts to
collect; if that feels steep in a demo, the earn-rate lever is the knob.
Classifier guardrail hit once: do NOT insert fabricated student/locker rows
into prod via SQL — use the UI path (demo students get combos since b64fb93,
and [DEMO] claims auto-receive a pre-decorated showcase layout).

**Business (unchanged):** $199/mo flat, founding $149/mo first 15 CA schools,
260-school list in hand, marketing site at dailywins-schools.vercel.app,
`dw.surestepeducation.com` still awaits the Cloudflare CNAME.

**Local-only (this machine, NOT in git):** Firefox role profiles + roles
command; `package.json` dev scripts stay UNCOMMITTED; worktree folders carry
copied `.env.local`; ~/Desktop/compliance/ holds the rendered PDF packet.

**Test accounts (prod):** NBPS (surestep3@proton.me, pseudo-director, locker
activated, Ava's demo locker walked); South Sac cluster unchanged; founder =
Devin's Google in Chrome — founder@PGHS also has the locker activated.

## What's queued next
0. **Eyeball 6/13 design work in the running app** (laptop) — the new playful
   splash (fresh tab / clear `ssd-splash-seen` to replay), the calm loader on
   a dashboard data-load, and the rebuilt locker open on /locker (refresh =
   no splash bleed; tap-to-open = one clean LEFT-hinge swing, no size jump).
   Build + tsc + lint all pass; visual confirmation is the open loop.
1. **Devin's compliance moves** — email EGUSD's privacy officer (draft at
   docs/compliance/egusd-outreach-email.md, PDFs on Desktop), counsel pass on
   /privacy.
2. **Locker carried items** — proud-work showcase shipped; still specced:
   packs are DONE, teacher-shelf is DONE, so what remains is **Song of the
   Week** (explicit-filter only), **countdown card**, **progress printout**,
   **sticky notes** (after the school visibility toggle), **school visibility
   toggle** itself (decision #3), **identity-merge tooling** (canonical_id
   exists, no admin UI), Chromebook perf test at the 40-item cap.
3. **Director console remainder** — second school admin invite; student ID /
   placing-district roster fields; attendance summary (ADA billing);
   September "welcome back" email (calendar item); business plumbing
   (billing, export/offboarding, PITR promise).
4. **Standing verifications** — monster-schedule retest, NBPS teacher-invite
   + link-policy walk, PDF/arrival eyeballs, act-as schedule live-verify.
5. **Marketing launch steps** — CNAME → Nick dry-run → first 25-school batch.

## Working guardrails (current)
- **Reversibility gate:** reversible work proceeds (incl. backed-up prod
  writes); **snapshot before every prod mutation;** queue one-way doors for an
  attended + approved moment. Never insert fabricated student rows into prod.
- Guarded-apply or stage-test migrations — restore point first, verify after.
- A passing type-check is not a working feature — close the loop in the app.
- `auth.uid()` for attribution; `effective_user_id()` for data access.
- **After every push, confirm the Vercel deployment exists** (webhook can miss).
- **Locker surfaces:** student-writable state is always bounded (ids, enums,
  preset indexes, allowlisted URLs) — never free text; locker tables are
  zero-policy RLS, server routes only; review generated art visually before
  shipping.
- PII-blindness boundaries (post-047) unchanged: teachers → own students;
  NPS director → everything at their school (audited); district admins →
  aggregate; Operator → blind.

## Infrastructure
- **Prod app:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Migration head:
  **`055`.** Vercel project `dailywins`, three domains. OTP expiry 86400s.
- **Marketing site:** Vercel project `dailywins-schools`
  (dailywins-schools.vercel.app) ← `dailywins-marketing/website/` via CLI.
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2), paused manually.
- **Company site:** surestepeducation.com = Netlify behind Cloudflare.
- **Git:** `main` deploys; `frontend`/`backend` worktree branches exist but
  this whole session ran on `main` — they are now ~25 commits behind; fast-
  forward them (`git push origin main:frontend main:backend` or re-merge)
  before using the worktrees again.

## To continue on the other machine
`git pull`, then tell Claude: *"Read HANDOFF.md and ROADMAP.md, then let's
continue."* Overwrite the passphrase line whenever you want a fresh marker.
The worktree folders are local to each machine — recreate with
`git worktree add ../dailywins-frontend frontend` (+ backend) if wanted there.
