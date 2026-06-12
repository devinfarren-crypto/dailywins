# The Locker — Teacher Shelf (Prompt 2C)

*Drafted 2026-06-12. SHIPPED same day as migration 055 (not 054 as guessed
below) — shared constants in src/lib/locker/shelf.ts, student transitions in
app/api/locker/shelf, teacher actions (shelf_grant / shelf_confirm /
shelf_return / shelf_revoke) in app/api/locker/teacher, grant + pending UI on
/locker/manage, shelf objects rendered in LockerClient (first five on the
shelf, overflow on the cavity floor). Redeemed items auto-archive after 5
days via a lazy sweep in /api/locker/state.*

*Original spec follows. The cavity shelf is the one surface a student doesn't
control: teachers place real-world rewards there as physical objects —
tickets, punch cards, folded notes. Grants, not purchases: the points ledger
is untouched.*

## Item templates (v1)

| template_id | Object | Default label |
|---|---|---|
| hw-pass | perforated ticket stub | "Homework Pass" |
| late-pass | ticket stub (different color) | "Late Pass" |
| snack-coupon | punch card | "Snack Coupon" |
| front-of-line | ticket | "Front of the Line" |
| shoutout | folded note w/ wax-seal sticker | "Shoutout" (teacher note inside) |
| custom | teacher picks ticket/punch-card/note skin | teacher-written label (≤40 chars) |

Visual: drawn sitting ON the shelf line (y locked to shelf band, x assigned in
grant order), hard contact shadow, slightly larger than stickers, NOT
draggable/resizable/removable by the student. Tap → detail sheet → "Use this".

## State machine

```
granted ──student taps "Use this"──▶ pending_redemption ──teacher confirms──▶ redeemed
   │                                        │                                   │
   │◀──────teacher declines (back)──────────┘                          (auto, +5 days)
   └──teacher revoke──▶ revoked                                              ▼
                                                                          archived
```
- `redeemed` renders with a REDEEMED punch/stamp overlay for 5 days, then
  archives (hidden from the shelf, kept in history).
- `revoked` exists for teacher mistakes; vanishes from the shelf silently.
- Student actions: ONLY granted→pending_redemption. Everything else is the
  granting teacher (or any teacher of that class).

## Schema (migration 054, when built)

```sql
create table shelf_items (
  id uuid pk,
  student_id uuid not null references students(id) on delete cascade,
  granted_by uuid not null references teachers(id),
  template_id text not null check (template_id in ('hw-pass','late-pass','snack-coupon','front-of-line','shoutout','custom')),
  custom_label text check (char_length(custom_label) <= 40),
  note text,                          -- shoutout body / teacher note
  status text not null default 'granted'
    check (status in ('granted','pending_redemption','redeemed','revoked','archived')),
  granted_at timestamptz not null default now(),
  requested_at timestamptz,           -- → pending_redemption
  redeemed_at timestamptz,
  seen_at timestamptz                 -- powers the one-time "new on your shelf" cue
);
```
RLS: enabled, zero policies (server-routes-only, same posture as all locker
tables). Student routes resolve via the locker cookie and can only read own
rows + flip granted→pending_redemption + set seen_at. Teacher routes verify a
locker_identities row links the student to the caller's class.

Reporting: each grant/redeem writes a ledger-ADJACENT audit row
(`locker.shelf_grant`, `locker.shelf_redeem` in the existing audit_log) —
visible in teacher reporting later, never in points_ledger.

## Student-side flow

Locker opens → any shelf item with `seen_at IS NULL` gets one soft glow pulse
+ toast ("Something new on your shelf"), then `seen_at` set. Tap item →
sheet: object art, label, who gave it, note if any → **Use this** →
"Hand-raised! Your teacher will confirm." → item shows a WAITING tag until
the teacher confirms (or returns it to granted).

## Teacher-side flow (v1-minimal)

On /locker/manage: a "Give a reward" row — pick student(s) (or All), pick
template, optional label/note, Grant. Pending redemptions surface at the top
of the same page with Confirm / Not yet buttons. No new navigation surface.

## Tier note

This implements Tier 3 (teacher-mediated) and Tier 2 (shoutouts) from the
original reward-tier model — surfaced through the shelf instead of a separate
rewards tab.
