# The Locker — Points Economy & Bank

*Drafted 2026-06-11. The load-bearing rule: **spending never alters the
behavior record.** Earned points are behavior data, immutable, and every
chart/report reads them untouched. The wallet is a parallel ledger credited
FROM earnings — never the same number.*

## Two numbers, on purpose

- **Earned (behavior record):** derived from `behavior_scores` as today.
  Charts, parent links, director records, PDFs — all unchanged, forever.
- **Wallet (spendable):** `sum(points_ledger.amount)`. Goes down when a
  sticker is bought. Appears only inside the student view and the teacher's
  class-economy panel.

A student who earned 1,240 points and spent 800 still shows 1,240 everywhere
that matters. The bank panel shows both ("Earned all-time" / "In wallet") so
students never perceive spending as losing progress.

## Earn-to-wallet conversion — options and recommendation

| | Option A: real-time mirror | Option B: daily batch credit (**recommended**) |
|---|---|---|
| Mechanism | Trigger on `behavior_scores` writes credits wallet immediately | Nightly job (or first-open-of-day lazy credit) sums yesterday's earned points → one `earn` row |
| Feel | Instant gratification | "Yesterday you earned 22" — a daily open-the-locker ritual |
| Integrity | Score edits/corrections force compensating wallet rows all day | Scores settle before crediting; one clean row/day |
| Tunability | Rate changes awkward mid-day | Rate read at credit time; per-class config trivial |
| Load | Write amplification on every tap | One row per student per day |

**Recommendation: B**, lazy-on-open variant (credit any uncredited prior days
when the student opens the locker — no cron dependency), idempotent via the
`daily_earn` unique guard in data-model.md.

**Conversion rate:** default **1 behavior point = 1 wallet point**, stored as
per-class config (`conversion_rate`, default 1.0) — THE tuning lever. Teachers
adjust economy heat without ever touching behavior data. **Decision point:**
do pre-Locker historical points convert on launch? Recommend **no backfill;
start crediting at activation** + a one-time "locker-warming" grant (e.g. 100)
so day one isn't a zero-balance window-shop. (Open question #4.)

## Pricing bands (Tier 1, v1)

| Band | Price | Earn-time at ~20 pts/day | Items |
|---|---|---|---|
| Starter | 0 | — | day-one kit (see locker-spec.md) |
| Common sticker | 25–40 | 1–2 days | most stickers |
| Uncommon sticker / button | 60–90 | 3–5 days | buttons, louder stickers |
| Patch / rare sticker | 120–160 | ~1 week | patches, holo stickers |
| Background | 150–250 | 1–2 weeks | the saving-up anchor |
| Mirror | 300 | ~2–3 weeks | the one-per-locker flex |

Sanity: a typical student affords something small most weeks and saves toward
one anchor a month. No item priced beyond ~3 weeks of typical earning.

## Teacher controls

- **Adjustment** (±, reason required) → new `adjustment` ledger row, audited.
  For "found a calculator error" or class rewards — not discipline (negative
  adjustments allowed but the UI copy frames them as corrections).
- **Refund** → new `refund` row referencing the purchase ledger id; item
  removed from inventory (and layout) in the same transaction.
- **Conversion rate** per class (0.5×–2×), forward-only.
- Teachers **cannot**: edit/delete ledger rows, remove owned items outside a
  refund, or see one student's wallet from another student's view. Every
  teacher action is a ledger row with `created_by`.

## Anti-patterns we will not ship (hard list)

- No variable-ratio rewards, loot boxes, mystery packs, or randomized pricing.
- No expiring currency, decaying balances, or streak-loss mechanics.
- No countdown timers, flash sales, or "only 3 left!" scarcity theater.
- No leaderboards, visible peer balances, or any cross-student comparison.
- No pay-real-money anything. Ever.
- No taking: items, once owned, cannot be revoked as discipline.
- Prices are flat and posted; the same sticker costs every student the same
  (the class conversion rate tunes earning, not pricing).

The economy's job is identity expression and steady progression — a kid
saving two weeks for the navy background because it matches their stickers is
the entire win condition.
