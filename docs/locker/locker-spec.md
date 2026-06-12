# The Locker — Product Spec (v1 planning)

*Drafted 2026-06-11. Planning only — no code in this pass. Companion docs:
data-model.md, points-economy.md, catalog-schema.md, ui-plan.md,
build-plan.md. Open questions are batched in build-plan.md §6.*

## What it is

The Locker is the student-facing layer of DailyWins: the inside of a 1980s–90s
American school locker door, rendered as a personal canvas. Students earn
wallet points from the behavior goals their teacher already tracks and spend
them on stickers, buttons, backgrounds, and a mirror to decorate their door.
Overlap and layering are the point — a clean locker is a sterile locker.

The *objects* are nostalgic-physical (vinyl sticker sheen, enamel pin relief,
scratched mirror chrome, polaroid white borders, magnet shadows). The *UI
chrome around them* is Spotify/Discord dark-mode glass per design-system.md —
this is the one zone where the full dark-glass recipe is permitted. It is
explicitly not ClassDojo: no avatars, no mascots, nothing elementary-coded.
The register is "your locker, your music, your stuff" — high-school cool.

## Entry: the combo moment

Access is Canvas LTI 1.3 — identity arrives in the signed LTI token, so there
is no login. The teacher-generated 3-number combo (printed on a paper slip,
handed out like real locker assignments) is **first-launch theater, not
auth**: an animated combo dial; the student spins in their three numbers; the
door swings open onto a starter locker. The combo is verified once, links the
LTI identity to the roster row, and is never asked for again. Wrong combo →
the dial shakes (real-locker frustration, 2 tries then "ask your teacher").
Returning students go straight to an open locker.

## The canvas

A fixed-aspect locker-door interior (portrait, door-shaped, vents at top,
combo scratchplate detail). Coordinates are normalized (0–1) so layouts render
identically on any screen.

**Interaction model:**

| Action | Gesture | Notes |
|---|---|---|
| Place | Tap item in tray → it drops near center, selected | New items come from the Shoebox (inventory tray) |
| Move | Drag (pointer events, transform-only) | Items can hang off edges partially — like real stickers |
| Layer | Selected-item controls: bring forward / send back | Z-order is the soul of the aesthetic; no "auto-arrange" |
| Rotate | Rotation handle on selected item (snap at 0°, free otherwise) | ±45° clamp keeps things legible |
| Remove | Drag to Shoebox, or selected-item "put away" | Returns to inventory — owned items are never lost |
| Background | Picker swaps the door surface (paint/wallpaper/texture) | One active background; owning many, wearing one |

**Caps (Chromebook + design):** max **30 placed items**; one background; one
mirror; one Song of the Week card. Hitting the cap says "Your locker's full —
put something in the shoebox," not an error tone.

## Item types

| Type | Physicality | v1 source | Notes |
|---|---|---|---|
| Sticker | Flat vinyl, slight sheen, die-cut edge | Starter + store | The volume item; most of the catalog |
| Button/pin | Round, enamel relief, drop shadow | Store | Reads "earned" — slightly pricier than stickers |
| Patch | Embroidered texture, stitched border | Store | Rarer; visual weight tag `loud` |
| Magnet | Thick, matte, hard shadow | Starter | Holds the schedule card and polaroids visually |
| Mirror | Chromed rectangle w/ scratches; subtle CSS reflection (no camera) | Store, one per locker | The flex purchase |
| Polaroid | White-border frame | Starter frames; images from a **preset art pack** | **No photo uploads in v1** (FERPA/moderation — see open questions) |
| Schedule card | The student's real bell schedule, index-card style | Free, automatic | The utility anchor — a reason to open the locker daily |
| Background | Paint color / wallpaper / texture for the door | 2 starters + store | Cheapest big transformation; store anchor |
| Song of the Week | Cassette/cd-case card: album art + track + artist | Free slot, student-set weekly | Art via iTunes Search API / Cover Art Archive — **never Spotify** (blocked on EGUSD Chromebooks). Search results filter `explicit`. |

## Starter kit (every student, day one, free)

1 background (tan "fresh paint") + 1 alternate (navy), 5 stickers, 2 magnets,
3 polaroid frames + preset art pack, the schedule card, and the Song of the
Week slot. The locker must feel decoratable in the first 60 seconds without
spending — spending makes it *yours*, not *usable*.

## What students cannot do

- See any other student's locker, balance, or items (no social comparison).
- Enter free text that another person sees (Song of the Week is a structured
  search pick, not typed text on the door).
- Upload images (v1).
- Lose anything: no expiring items, no streak penalties, no item removal as
  discipline. Teachers cannot reach into a locker and take things.
- Buy anything that isn't a flat, posted price (no loot boxes, no gacha, no
  "limited time!" timers) — see points-economy.md anti-patterns.

## Teacher-visible surface

Teachers see wallet balances and the ledger for their students (it's their
class economy) — but **not** the locker interior by default; the locker is the
student's room. (Flagged in open questions — a "locker visible to teacher"
toggle may be wanted for acceptable-content assurance, but with no uploads and
no free text, v1 content risk is near zero by construction.)

## Done-right test

A 10th-grader with 6 stickers half-overlapping, a crooked Song of the Week
card, and a mirror at eye level should feel like 1994. If it feels like a
rewards chart, we missed.
