# The Locker — Decisions Log (2026-06-12)

*All eight open questions from build-plan.md §6, answered by Devin. These
supersede the corresponding sections in the planning docs; affected docs have
been amended.*

| # | Question | Decision |
|---|---|---|
| 1 | design-system.md authority | **The Locker is exempt from the Sure Step design system.** Design to the locker's own brief (dark-mode Spotify/Discord register, nostalgic-physical objects); accessibility (WCAG 2.1 AA, reduced-motion/transparency) remains a floor. |
| 2 | Identity linking | **Unify student identity school-wide FIRST.** Duplicate roster rows merge into one school-level student; locker + wallet hang off the unified identity. This is a Phase-1 prerequisite, not debt. |
| 3 | Teacher locker visibility | **School toggle.** Private by default; the director/site admin can enable teacher viewing school-wide (same pattern as `schools.link_settings`). |
| 4 | Wallet at activation | **No backfill + one-time ~100-point welcome grant.** Crediting starts at activation; day one equal and generous. |
| 5 | Song of the Week | **Explicit-filter only; no time lock.** iTunes results filtered non-explicit; change anytime; "of the Week" is flavor. |
| 6 | Where it lives | **Same Next.js app, `/locker/*` routes.** One repo, one deploy, shared schedule data + migrations. |
| 7 | Economy lever | **Earn rate only (0.5×–2× per class).** Prices universal; the price multiplier is dead. |
| 8 | Access / Canvas | **Canvas CANNOT be relied on — no school in the pipeline is known to have it.** The Locker ships on DailyWins-native access: the existing student magic-link token infrastructure carries entry, the combo slip is the first-launch claim. **LTI 1.3 moves from "decided" to "future adapter"** for whenever a Canvas district materializes. Devin will supply screenshots/examples of real lockers for the visual build. |

## What decision #8 changes (the big one)

The original constraint "Access: Canvas LTI 1.3, identity via signed LTI
token" is replaced by:

- **Entry:** a student opens their locker via a locker link/token minted by
  the teacher — same `magic_links`-style machinery already proven for
  parent/student views (token sha256-hashed, revocable, school link-policy
  aware). A new scope (`locker`) with **long-lived, device-bound** behavior:
  the first visit runs the combo claim, then sets a durable signed cookie so
  the locker opens instantly on that device (the Chromebook they use daily).
- **The combo slip is the claim, as before** — teacher prints slips; student
  enters 3 numbers on first launch; combo binds the token/device to the
  unified student identity. Lost device / cleared cookies → re-enter combo
  from the slip (or teacher reprints). This is BETTER theater than LTI: every
  student gets the dial moment, not just first-launch.
- **`student_identities` is repurposed:** drop `lti_issuer/lti_subject` for
  v1; keep `combo`, `claimed_at`, plus device-claim bookkeeping. Add an
  `lti_*` adapter later without schema upheaval (new columns, same table).
- **Phase 0 #1 (LTI spike) is replaced** by: combo-claim + durable-cookie
  flow design (cookie lifetime, multi-device policy, re-claim UX) and a
  review that locker tokens respect the school's link policy controls.
- **Security note:** a locker token + combo grants access to ONE student's
  locker and wallet — no behavior-record reads beyond what the existing
  student link already exposes, and the wallet/ledger is the least sensitive
  data in the system. Director link-policy control (047) extends to the
  locker scope so a school can turn the whole feature off.
