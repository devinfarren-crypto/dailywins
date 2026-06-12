# The Locker — UI Plan

*Drafted 2026-06-11. Register: Spotify/Discord dark-mode glass (the ONE zone
where the full dark-glass recipe is permitted), wrapping nostalgic-physical
objects. Constraints honored throughout: blur/opacity hard limits from
design-system.md, `@supports (backdrop-filter)` + `prefers-reduced-transparency`
fallbacks to solid surfaces, `prefers-reduced-motion` variants for every
animation, WCAG 2.1 AA — and the teal rule: **#2E8F8F fails as text on dark;
use #1F6E6E on light surfaces / a luminance-checked tint on dark.** All locker
text gets contrast-checked against the DARKEST and LIGHTEST background a
student can buy.*

## Screen flow

```
Canvas LTI launch
   └─ first time → ComboIntro (dial animation, 3 numbers, door swings open)
   └─ returning  → LockerView (door open)
        ├─ ItemTray "Shoebox" (slide-up: owned, unplaced items)
        ├─ StorePanel (slide-over)
        │     └─ ItemDetailSheet → PurchaseConfirm → (owned → tray)
        ├─ BankPanel (slide-over: balance + ledger)
        └─ SongOfWeekPicker (search → pick → card updates)
```

One screen with sheets — no page navigation inside the locker. Back/escape
always returns to the canvas.

## Component inventory

| Component | Role | Notes |
|---|---|---|
| `LockerView` | Layout shell: door frame, vents, dark-glass top bar (balance chip, store + bank + shoebox buttons) | Top bar is the glass; the door itself is opaque art |
| `LockerCanvas` | The decorated door; renders layout JSON | Fixed aspect, normalized coords; single `transform: scale()` to fit viewport |
| `LockerItem` | One placed item: image + selection ring + handles | `transform: translate3d/rotate` ONLY — never top/left; `touch-action: none`; `will-change` only while dragging |
| `SelectionControls` | Forward / back / rotate / put-away pills near selected item | 44px touch targets; also keyboard: arrows move, [ ] layer, r rotates — the accessibility path for drag |
| `ItemTray` ("Shoebox") | Owned-but-unplaced items; tap to place | Virtualized row; lazy images |
| `BackgroundPicker` | Owned backgrounds; one active | Inside Shoebox as a tab |
| `StorePanel` | Catalog grid, filter chips by type/tag | Price chip on each card; owned = "In your shoebox" |
| `ItemDetailSheet` | Big preview on a mini-door, price, weight tag | "Try it on" preview against the student's CURRENT background |
| `PurchaseConfirm` | "Boombox — 30 pts. You'll have 12 left." Confirm/cancel | No dark patterns: cancel is equal weight; insufficient funds shows plain math ("You have 18 — earn 12 more"), never a timer |
| `BankPanel` | Balance, earned-all-time, ledger list (earn/spend/refund/adjustment rows, plain language) | "Spending never touches your record" copy line; AA-checked greens/corals on dark |
| `ComboIntro` | Dial animation, 3 inputs, shake on miss, door-open reveal | Reduced-motion: crossfade instead of swing; 2 misses → "ask your teacher" (no lockout spiral) |
| `SongOfWeekCard` | Cassette-case card on the door | Art from iTunes Search / Cover Art Archive (NEVER Spotify); cached server-side |
| `SongOfWeekPicker` | Search sheet (debounced), results w/ art + explicit filter | Server route proxies the API: keys hidden, results cached, `explicit` filtered |
| `ScheduleCard` | Real bell schedule as an index card | Free, auto-placed; reuses existing schedule data |

## Dark-glass usage map

Glass (within recipe limits): top bar, sheets/panels, selection pills.
**Never glass:** the door art, placed items, text under 16px. Max TWO glass
layers composited at once (a sheet over the top bar = at limit; nested sheets
replace, not stack). Fallbacks: `@supports not (backdrop-filter)` and
`prefers-reduced-transparency` → solid `#1a1a2e`-family surfaces at full
opacity. Focus rings and selection states must hit AA on glass — test on the
corkboard (light) and navy (dark) backgrounds both.

## Chromebook performance (the real device target)

Risks, in order, with mitigations:

1. **Drag jank** → pointer events + `translate3d` transforms only; no layout
   reads in the move handler (cache rect on pointerdown); rAF-throttled state;
   commit layout to React state on pointerup only (drag lives in a ref).
2. **Layered transparency** → glass cap above; placed items are plain opaque
   PNGs/WebPs with baked-in shadows (no CSS `filter: drop-shadow` per item —
   bake shadows into assets).
3. **Image weight** → ≤100 KB/asset, lazy-load store grid, preload only
   placed items + tray thumbnails; `content-visibility: auto` on store cards;
   total placed-canvas budget ~3 MB worst case (30 × 100 KB).
4. **Item count** → hard cap 30 placed (DB CHECK + Zod + UI), each item one
   composited layer only while selected/dragging.
5. **Combo/door animation** → transform+opacity only, no canvas/WebGL;
   reduced-motion crossfade.

Perf acceptance test (build-plan §5): smooth drag on a 4 GB Celeron
Chromebook with a 30-item locker on the corkboard background.

## Accessibility checklist

Keyboard path for every drag action (SelectionControls); visible focus;
sheets trap focus and restore; live-region announcements for purchase +
placement ("Boombox placed"); all text AA against worst-case backgrounds;
hit targets ≥ 44px; no information conveyed by color alone (ledger rows get
+/− glyphs, not just green/coral).
