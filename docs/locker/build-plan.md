# The Locker — Build Plan

*Drafted 2026-06-11. Planning session output — no application code yet.
Phases assume the existing repo (Next.js/Supabase/Vercel, migrations 053+).*

## Phase 0 — Pre-build verifications (do before any code)

1. **Combo-claim access flow (replaces the LTI spike — decision #8).**
   Design + prove the DailyWins-native entry: locker link scope on the
   existing magic-link machinery, combo claim binding a durable signed
   device cookie to the unified student identity, re-claim UX for new
   devices/cleared cookies, director link-policy control over the scope.
   LTI 1.3 is parked as a future adapter (same identity table, new columns
   later).
2. **Asset storage decision.** Static `public/locker/` (recommended for v1:
   versioned with the catalog, CDN-cached by Vercel, zero infra) vs Supabase
   Storage (needed only if items ever upload at runtime — they don't in v1).
   Verify Vercel build size stays sane with ~5 MB of WebP.
3. **iTunes Search API smoke test** from a server route: rate limits
   (~20 req/min/IP unauthenticated — needs caching), `explicit` flag
   reliability, art URL stability; Cover Art Archive as fallback. Decide
   cache table vs in-memory.
4. **Combo slip generation** fits the existing print pathway? (Teachers
   already print things — confirm a printable slip sheet route is enough.)
5. **design-system.md into the repo** — referenced as authority but not
   present here (see open question #1).

## Phase 1 — Spine (migrations 053–055, no UI)

`student_identities`, `points_ledger` (+ immutability trigger + daily-earn
unique guard), `student_inventory`, `locker_layouts`; Zod schemas; the LTI
launch route (token verify → session cookie) + combo-claim route; lazy daily
earn credit; starter-grant on first claim. Exit test: scripted launch →
claim → balance reflects yesterday's behavior points.

## Phase 2 — Canvas (read/decorate)

LockerView + LockerCanvas + LockerItem + SelectionControls + ItemTray +
BackgroundPicker; layout save route (ownership + cap validation); schedule
card. Exit: a student can arrange their starter kit and it survives reload
and device switch.

## Phase 3 — Store + bank

StorePanel, ItemDetailSheet, PurchaseConfirm; atomic purchase route (one
transaction: ledger spend row + inventory row, balance re-checked inside);
BankPanel with ledger history. Teacher side: minimal class-economy panel
(balances + adjustment/refund actions) — can be founder-built SQL-backed
forms in v1. Exit: earn → buy → place → refund round-trip, with
`behavior_scores` provably untouched (diff test).

## Phase 4 — Theater

ComboIntro animation; Song of the Week (server proxy + cache + picker +
card); polaroid preset art pack; empty/onboarding states; reduced-motion
variants. Exit: first-launch feels like opening a locker, not a form.

## Phase 5 — Hardening

Chromebook perf pass against ui-plan.md budgets (real 4 GB device);
accessibility pass; RLS/permission adversarial review (can a forged session
read another locker? can a replayed purchase double-spend?); pilot with one
class.

## Stubbed in v1 (visible but inert)

- Rewards tab shows Tier 2 (titles/certificates/shoutouts) and Tier 3
  (teacher-mediated physical) as "coming soon" rows — no redemption flow.
- Polaroid photo uploads (preset art only).
- Teacher locker-visibility toggle (decided in open questions).
- Multi-class wallets (one wallet per student per school in v1; the ledger
  ref carries class context so a future split is a migration, not a rebuild).

---

## §6 Open questions (single batch, all docs)

1. **design-system.md is not in this repo** — the prompt's constraints
   (dark-glass recipe, blur/opacity limits, #1F6E6E teal) are honored from
   the prompt text, but commit the real file so CI/code review can cite it.
2. **Identity linking:** combo-claim maps an LTI identity to a roster
   `students` row — but which class roster, when a student appears in two
   DailyWins teachers' rosters? Options: (a) one student row per teacher
   stays as-is and the combo binds to ONE row (simple, but two lockers);
   (b) school-level student identity unifying duplicate roster rows
   (correct, bigger lift). **Recommend (a) for v1 pilot** (one teacher per
   pilot class) and flag (b) as the known debt.
3. **Teacher visibility of the locker interior:** private-by-default
   (recommended — no uploads/free text means near-zero content risk) or a
   teacher toggle? Affects RLS and the trust story.
4. **Wallet backfill at activation:** none + 100-point locker-warming grant
   (recommended) vs converting historical points (rich kids on day one,
   wildly uneven)?
5. **Song of the Week guardrails:** iTunes `explicit=No` filter only
   (recommended; zero teacher burden) vs teacher-approval queue? And: is a
   weekly change limit (the name says weekly) a rule or just flavor?
   Recommend: changeable anytime, card *says* "Song of the Week" — rules
   that need policing aren't worth a sticker.
6. **Where The Locker lives:** same Next.js app under `/locker/*`
   (recommended: shares schedule data, migrations, deploy) vs separate app.
   LTI's iframe/cookie requirements (SameSite=None; Partitioned) need a
   spike either way — Phase 0 #1 now covers the native flow instead.
7. **Per-class price multiplier:** points-economy.md recommends tuning the
   EARN rate only and keeping prices universal. Confirm killing the price
   multiplier entirely.
8. **Which Canvas for the pilot:** EGUSD's (admin approval needed — pairs
   with the CSDPA conversation) or an NPS customer's Canvas/none? If NPS
   schools don't run Canvas, the Locker's access story for them needs a
   plan B (magic-link student tokens exist already and could carry it).
