# Sure Step Education — Company Aesthetic

**One unified design system for every Sure Step Education project.** Drop this file in the repo root, point your tokens at it, and any new tool, splash screen, or page will read as part of the same family.

**Last updated:** June 9, 2026
**Status:** Canonical. Reconciled from the live website brand, the DailyWins dashboard, and BehaviorLog Pro.
**Anchor:** The live company website (surestepeducation.com) is the source of truth. Where sources disagreed, website values win.

---

## Voice in one line

Warm cream paper, ink-navy structure, a green signature with amber warmth — an editorial serif over a clean sans, with mono eyebrow labels. Calm, credible, built by teachers and made to run in a district.

**Tagline:** Built by teachers. Built to work.

---

## 1. Color tokens

Use the role name in code, not the raw hex. That's what keeps every project in sync — change the value here, every repo inherits it.

### Core / brand

| Token | Hex | Role |
|-------|-----|------|
| `--navy` | `#252a4a` | Primary dark **field** — splash background, dark sections, header bands. A touch lighter than ink, by design (a full-viewport `#1a1a2e` field read too black). |
| `--navy-soft` | `#2a2b48` | Softer navy for layered dark surfaces. |
| `--forest` | `#0F6E56` | Deep green. Primary buttons / CTAs, footer. |
| `--teal` | `#1D9E75` | **Signature accent.** Links, secondary actions, active states. |
| `--teal-light` | `#5DCAA5` | Light teal. Gradients, hover tints, accent fills. |
| `--mist` | `#E1F5EE` | Pale teal tint. Status pills, soft highlight backgrounds. |
| `--amber` | `#EF9F27` | Warm accent. "In dev" status, highlights, the growth curve. |
| `--amber-soft` | `#FFF1D6` | Amber tint background for amber pills. |

### Surfaces & text

| Token | Hex | Role |
|-------|-----|------|
| `--cream` | `#F7F5F0` | Page background (warm cream). |
| `--cream-deep` | `#EFEBE0` | Alternate / banded surface. |
| `--surface` | `#FFFFFF` | Cards, panels, modals. |
| `--ink` | `#1a1a2e` | Primary body text. The darkest blue — kept near-black for text contrast (the navy *field* is the lighter `#252a4a`). |
| `--ink-2` | `#4a4a5e` | Secondary text, paragraph copy. |
| `--ink-3` | `#7a7a8e` | Muted text, captions, metadata. |
| `--rule` | `#d9d4c5` | Hairlines, dividers, borders. |
| `--rule-soft` | `#ebe7da` | Faint dividers, card edges. |

### Status scale (product UI — behavior, progress, mastery)

A tuned four-zone gradient, low → high. Use for Daily Wins, Behavior Tracker, and any progress UI. These are a calibrated *set* — don't swap one value in isolation.

| Token | Hex | Zone |
|-------|-----|------|
| `--status-low` | `#dd6b4d` | Needs support (red/coral) |
| `--status-mid` | `#e3a23c` | Working on it (amber) |
| `--status-good` | `#4fa07e` | On track (green) |
| `--status-high` | `#5e97c4` | Exceptional (blue) |

> Note: `--status-mid` (`#e3a23c`) is intentionally a hair warmer than brand `--amber` (`#EF9F27`) so the four steps read evenly. Brand amber is for accents; the status amber is for the scale.

### Semantic / category (app pills, alerts, tags)

For category chips, alerts, and functional color in product UIs. Brand-harmonized.

| Token | Hex | Tint | Use |
|-------|-----|------|-----|
| `--success` | `#067a5f` | `#e8f8f3` | Positive states, confirmations, sessions |
| `--warning` | `#d99200` | `#fef8e2` | Warnings, cautions |
| `--error` | `#d43c3c` | `#fdf0f0` | Errors, destructive actions, sign-out |
| `--info` | `#3498c0` | `#e5f2fa` | Team, collaboration, neutral info |
| `--accent-purple` | `#7b4ab4` | `#f1eaf8` | Settings, customization |

---

## 2. Typography

Three roles, three faces, all from Google Fonts. Display sets the personality; the sans does the work; the mono signals "system."

| Role | Face | Stack | Weights | Use |
|------|------|-------|---------|-----|
| **Display / headings** | DM Serif Display | `"DM Serif Display", Georgia, serif` | 400 | H1–H3, hero, splash wordmark, product names |
| **Body / UI** | DM Sans | `"DM Sans", system-ui, sans-serif` | 400 / 500 / 600 | All body copy, buttons, UI |
| **Eyebrows / labels / data** | DM Mono | `"DM Mono", ui-monospace, monospace` | 400 / 500 | UPPERCASE eyebrows, metadata, URLs, status labels. Letter-spacing ~0.14em |

**Google Fonts link:**
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
```

### Type scale

Headings use fluid `clamp()` so they scale with viewport. Tight leading on display, comfortable on body.

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| H1 | `clamp(48px, 7vw, 96px)` | 400 | line-height 1.05, letter-spacing -0.01em |
| H2 | `clamp(36px, 4.5vw, 64px)` | 400 | line-height 1.05 |
| H3 | `clamp(22px, 2.4vw, 32px)` | 400 | |
| Body | 16px | 400 | line-height 1.55 |
| Lede | 17–18px | 400 | line-height 1.6, for intros |
| Eyebrow | 11px | 500 | mono, UPPERCASE, letter-spacing 0.14em |
| Small / meta | 13–14px | 400 / 500 | |

### Sanctioned alternate (editorial)

If a project wants a warmer editorial feel, this pairing is approved and brand-safe — but **the whole company moves together**, including the public site, to stay unified:

- Display: **Fraunces** — `"Fraunces", Georgia, serif`, weights 400–600
- Body: **Inter** — `"Inter", system-ui, sans-serif`, weights 400/600/700/800
- Mono: **IBM Plex Mono** — `"IBM Plex Mono", ui-monospace, monospace`, weights 400/500

Swap the three `--font-*` tokens below; nothing else changes.

```css
--font-display: "DM Serif Display", Georgia, serif;
--font-body:    "DM Sans", system-ui, sans-serif;
--font-mono:    "DM Mono", ui-monospace, monospace;
```

---

## 3. Shape & depth

| Token | Value |
|-------|-------|
| `--radius-sm` | `8px` |
| `--radius` | `12px` (cards default) |
| `--radius-lg` | `18px` (product cards, modals) |
| `--radius-pill` | `999px` (buttons, status pills) |
| `--shadow-sm` | `0 1px 2px rgba(26,38,61,.06)` |
| `--shadow` | `0 1px 2px rgba(26,38,61,.06), 0 6px 16px rgba(26,38,61,.07)` |
| `--shadow-lg` | `0 18px 50px rgba(26,26,46,.08)` |
| `--focus-ring` | `2px solid #1c5c3c` |

---

## 4. Motion

Restraint over flourish. One orchestrated moment beats scattered effects, and everything respects `prefers-reduced-motion`.

| Use | Timing |
|-----|--------|
| Standard transition | `0.15s–0.2s ease` |
| Card / element entrance | `0.6s ease` (slide up 20px + fade) |
| Splash sequence | staggered, see §5 |
| Ambient float (optional) | `5–8s ease-in-out infinite`, opacity ~0.1 |

---

## 5. Splash screen (the unified front door)

Every app opens the same way: navy field, the ascending-bars logo drawing itself, the wordmark fading up, then a clean dissolve into the page. This is the single most recognizable shared moment across the suite — keep it consistent.

**Spec:**
- Background: `--navy` (`#252a4a`), full viewport.
- Icon: inline SVG bar-chart / staircase with the amber growth curve (below). Use SVG on dark, never the JPG — the JPG has a white box and washes out.
- Sequence: icon fades up (0.15s delay) → wordmark fades up (0.35s) → four bars grow left-to-right (0.55s / 0.7s / 0.85s / 1.0s) → optional Skip button (1.2s).
- Auto-dismiss after ~2.2s; dissolve with `opacity` + slight `scale(1.05)` over 0.6s.
- Wordmark: "Sure Step" in DM Serif Display white, "Education" beneath in `--teal-light`.

**Logo SVG (splash / dark backgrounds):**
```html
<svg width="100" height="100" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="38"  y="120" width="22" height="40"  rx="3" fill="#E1F5EE"/>
  <rect x="68"  y="98"  width="22" height="62"  rx="3" fill="#5DCAA5"/>
  <rect x="98"  y="74"  width="22" height="86"  rx="3" fill="#1D9E75"/>
  <rect x="128" y="48"  width="22" height="112" rx="3" fill="#0F6E56"/>
  <path d="M38 150 C 78 124, 128 100, 158 36" stroke="#EF9F27" stroke-width="4" stroke-linecap="round" fill="none"/>
  <circle cx="158" cy="36" r="6" fill="#EF9F27"/>
</svg>
```

**Logo usage rule:** SVG icon on navy/dark; full `logo.jpg` wordmark only on cream/light backgrounds.

---

## 6. Density mode (classroom / iPad)

For tools used at arm's length on a tablet, support a comfortable density that bumps type ~15%:

```javascript
document.body.dataset.density = 'comfortable';
```
```css
[data-density="comfortable"] { font-size: 115%; }
```

---

## 7. Buttons

| Variant | Fill | Text | Use |
|---------|------|------|-----|
| Primary | `--navy` | `--cream` | Main action |
| Teal | `--teal` (hover `--forest`) | white | Inline / secondary CTA |
| Ghost | transparent, `--navy` border | `--navy` | Tertiary on light |
| Ghost-light | transparent, white border | `--cream` | On dark backgrounds |

Shape: `--radius-pill`. Padding ~`14px 22px`. Hover lifts `translateY(-1px)`.

---

## 8. Implementation checklist

- [ ] Google Fonts link in `<head>` (DM trio above).
- [ ] CSS reset: `*{margin:0;padding:0;box-sizing:border-box;}`
- [ ] Tokens defined in `:root` (copy §1–3 values).
- [ ] `<meta name="theme-color" content="#252a4a">`
- [ ] Splash uses inline SVG, not the JPG.
- [ ] Visible keyboard focus + `prefers-reduced-motion` honored.
- [ ] Company name written "Sure Step Education" — two words, never "SureStep".

---

## 9. Quick reference

```
CORE
  Navy        #252a4a   structure, dark sections, splash (field)
  Navy soft   #2a2b48   layered dark
  Ink         #1a1a2e   text only (darkest blue, not a field)
  Forest      #0F6E56   primary CTA, footer
  Teal        #1D9E75   signature accent, links
  Teal light  #5DCAA5   gradients, hovers
  Mist        #E1F5EE   soft tint / pills
  Amber       #EF9F27   warm accent, growth curve

SURFACES & TEXT
  Cream       #F7F5F0   page background
  Cream deep  #EFEBE0   banded surface
  Surface     #FFFFFF   cards
  Ink         #1a1a2e   body text
  Ink-2       #4a4a5e   secondary
  Ink-3       #7a7a8e   muted
  Rule        #d9d4c5   dividers

STATUS SCALE          SEMANTIC
  Low      #dd6b4d       Success  #067a5f
  Mid      #e3a23c       Warning  #d99200
  Good     #4fa07e       Error    #d43c3c
  High     #5e97c4       Info     #3498c0
                         Purple   #7b4ab4

TYPE
  Display   DM Serif Display
  Body      DM Sans
  Mono      DM Mono
```

---

*Source of truth: the live company site. Update values here first, then let each repo pull from this file. Questions or proposed changes go through Devin or Nick.*
