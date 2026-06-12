# The Locker — Visual Upgrade Plan (Prompt 2A)

*Drafted 2026-06-12. Bar: a 16-year-old screenshots their locker. Every
technique below is transform/opacity/gradient-only — no runtime blurs, no
filters on placed items, Chromebook-first.*

## Materiality

**Locker metal (door + cavity).** Layered on the existing paint background,
all `pointer-events: none`, all static (zero per-frame cost):
1. *Brushed verticals:* one `repeating-linear-gradient(90deg, transparent 0 2px, rgba(255,255,255,.015) 2px 3px, rgba(0,0,0,.02) 3px 4px)` overlay — reads as grain at any paint color.
2. *Noise:* ONE tiny tileable noise SVG (`/locker/textures/noise.svg`, ~2KB, `feTurbulence` baked at build time into a raster-ish tile — applied as a repeated background-image at ~8% opacity, never a live filter).
3. *Recessed door panel:* inset rounded rect drawn with two box-shadows (light top-left, dark bottom-right) — the classic embossed-metal trick.
4. *Vents with depth:* each slat = dark fill + `box-shadow: inset 0 2px 2px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.10)` (shadow under the top lip, highlight on the bottom edge — light from above).
5. *Hardware:* hinge knuckles (already shipped) get a brighter specular line; latch gets a screw dot at each end (two 2px radial gradients).

**Stickers.** Asset-level (baked into the SVGs, zero runtime cost):
- Die-cut white border stays; add a 1px inner gray stroke so the border reads on light paints.
- *Pressed-on shadow:* placed items keep the current drop-shadow; on the slap-down animation the shadow scales from loose to tight (one keyframe pair).
- *Placement tilt:* new items already land at random ±7°; clamp to ±4° per the brief.
- *Peeling-corner variant:* a baked SVG corner-curl gradient on select stickers (a `worn` tag), not a runtime effect.
- *Holo/foil:* rarity `foil`/`holo` items get a CSS gradient sheen sweep **only while selected or on tap** (`.lk-holo.selected::after`, 600ms one-shot, transform-driven) — never idle-animating (performance + photosensitivity).

**Buttons/pins:** rim highlight + pin-back shadow baked in assets (already partially there; tighten). **Magnets:** flatter, hard 1px-offset shadow. **Polaroids:** white frame + a baked "tape" strip across the top corner.

**Paint jobs:** door and cavity are both painted by the background today; the catalog gains finishes — matte black, deep red, mint, chrome (vertical metal gradient), chalkboard (chalk-doodle texture baked), rust/grunge, galaxy. *Cavity-painted-separately* is a store SKU question → question batch.

## Juice (all ≤250ms, transform/opacity only, reduced-motion = off)

| Moment | Effect |
|---|---|
| Place item | `lkSlap`: scale 1.12→1 + shadow tightens, 180ms cubic-bezier(.2,1.4,.4,1) (slight overshoot = thunk) |
| Drag end | `lkSettle`: 1.04→1, 120ms — the wobble-settle |
| Sheet open | existing slide-up; **items stagger in** via `animation-delay: calc(var(--i) * 22ms)` capped at 10 items (rest appear instantly) |
| New-shelf-item cue | one 1.2s soft glow pulse on the shelf item + a toast, ONCE per grant (localStorage seen-set) |
| Sound | **off by default, v1 ships none** (question batch) — if added later: 3 short samples (click, slap, ka-chunk), Web Audio, toggle in a corner |

## Density & first impression

- Cap: raise 30 → **40 placed items** pending a Chromebook test (DB CHECK + Zod + UI together). 40 absolutely-positioned opaque images is well within budget; the test is drag latency with 40 siblings.
- **Inspiration ghost state:** empty locker renders 4–5 faint (12% opacity, non-interactive) ghost outlines — a sticker spot, mirror at eye level, something on the cavity wall — with "make it yours" copy. Disappears after the first placement, forever.
- **Demo locker pre-decorated:** when a [DEMO] student's locker is first claimed, seed a full layout (12–15 items, layered, slightly chaotic) instead of the bare starter drop — the demo first impression is the *aspiration*, not the empty state.

## Performance checklist (Chromebook)

No `backdrop-filter` anywhere in the locker. No `filter:` on placed items
except the existing static drop-shadow (consider baking shadows into assets
at the art pass if 40-item drag jitters). One noise tile shared by all
surfaces. Stagger animations are one-shot. Holo sheen only on interaction.
Test: 40-item locker, chalkboard paint, drag at 60fps-ish on a 4GB Celeron.
