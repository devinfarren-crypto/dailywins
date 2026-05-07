# DailyWins Summer Roadmap

Last updated: May 7, 2026

## Bugs to fix
- Demo Mode: Phone Out of Sight always shows zero (real student data fine)
- Demo Mode: On Task sometimes shows zero (verify against more demo students)
- Notes modal: confirm period list always matches active schedule (false alarm 5/7, but worth verifying with Nick on COHS once he's added notes)

## After June 8
- Move bell schedules out of code into a `schools` table (JSONB column for variants).
  Why: hardcoded TypeScript doesn't scale past 2-3 schools.
  Cost: ~10 hours including admin UI.
  Trigger: third school joins pilot, OR EGUSD asks how we onboard new schools.

## Pilot status (snapshot 5/7/2026)
- Devin: PGHS
- Tommy: PGHS (different room)
- Nick: COHS
- Allowlist enforced: only these 3 emails can sign in
- Demo Mode shipped, working end-to-end except 2 cosmetic bugs above
