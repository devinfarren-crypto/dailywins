# The Locker — Themed Sticker Packs (Prompt 2B)

*Drafted 2026-06-12. ALL SEVEN PACKS SHIPPED same day (catalog v5): Arcade +
Mixtape in the first pass, then Side Quest / Kickflip / Cryptid Club / Y2K /
Varsity in the second. stk-skateboard moved to Kickflip per the spec. Art
reviewed via rendered contact sheet before shipping.*

*Seven packs, each 8 stickers + 1 background, every item
original art we own. Rarity = visual treatment + price ONLY (common / foil /
holo) — no drops, no timers, posted prices always.*

## Pricing bands by rarity

| Rarity | Treatment | Sticker price | Background price |
|---|---|---|---|
| common | flat vinyl | 25–40 | 150–250 |
| foil | metallic gradient fill, sheen on tap | 80–110 | — |
| holo | spectral gradient, sheen on tap | 130–160 | — |

Pack completion: store shows "n/9 collected" per pack (pride, not pressure).

## The packs

**1. Arcade / 8-bit** *(mascot: **Bitt**, a one-eyed pixel critter — round, cheerful, ours)*
pixel heart (common), pixel sword (common), HIGH SCORE marquee (common), joystick (common), INSERT COIN ticket (common), health bar full (common), level-up arrow (foil), Bitt (holo). Background: *Grid Horizon* — synthwave starfield grid.

**2. Side Quest (RPG/fantasy)** *(mascot: **Glorp**, a happy slime blob with a tiny sword)*
d20 (common), potion bottle (common), treasure chest (common), XP bar (common), quest scroll (common), CRITICAL HIT starburst (foil), SIDE QUEST banner (common), Glorp (holo). Background: *Parchment Map*.

**3. Mixtape (music)** *(mascot: **Demi**, a bouncing eighth-note with sneakers)*
cassette w/ handwritten label (common — exists as stk-cassette, joins pack), headphones (common), boombox (common — exists), vinyl record (common), equalizer bars (foil), NOW PLAYING card (common), NO SKIPS text (common), Demi (holo). Background: *Poster Wall* — original gig posters only.

**4. Kickflip (skate/street)** *(mascot: **Curb**, a pigeon standing on a board)*
deck bottom (common — exists as stk-skateboard, joins pack), traffic cone (common), GRIND script in original lettering (foil), scuffed helmet (common), road sign "SKATE ZONE" (common), banged-up shield sign (common), wheels (common), Curb (holo). Background: *Grip Tape* — stickered black grit.

**5. Cryptid Club (spooky-lite)** *(mascot: **Sasquish**, a soft round bigfoot waving)*
UFO (common), OUT THERE poster (common), moth-friend (original round-winged creature, foil), flashlight beam (common), footprint cast (common), question-mark polaroid (common), I SAW IT badge (common), Sasquish (holo). Background: *Night Woods* — dark pines + film grain.

**6. Y2K / Vaporwave** *(mascot: **Disco**, a CD with a face and legs)*
chrome smiley (foil), flip phone (common), butterfly clip (common), checkerboard flame (common — original check pattern, not Thrasher script), "vibes" bubble text lowercase (common), sparkle cluster (common), wavy sun (common), Disco (holo). Background: *Chrome Sparkle* — silver gradient + star glints.

**7. Varsity** *(mascot: **Champ**, an original badger in a letter sweater)*
letter "W" patch (common — W for Wins), foam finger (common), megaphone (common), pennant (common), MVP badge (foil), whistle (common), game ticket stub (common), Champ (holo). Background: *Banner Wall* — gym banners, school-neutral.

## Copyright self-audit

| Item | Evokes | Why it's clear |
|---|---|---|
| Bitt (pixel critter) | 8-bit era mascots | One eye, round body, original palette — no ghost skirt shape (Pac-Man trap avoided), no bean body (Among Us trap), no grid face (Creeper trap) |
| pixel heart/sword/joystick | arcade vocabulary | Generic objects predating any franchise; original pixel grids |
| INSERT COIN / HIGH SCORE / GG-adjacent text | arcade idiom | Common phrases, original type |
| Glorp (slime) | RPG slimes broadly | Slimes are genre-generic; ours has a unique face/sword; not teardrop-shaped (Dragon Quest trap) |
| d20 / potion / chest / scroll | tabletop fantasy | Public-domain objects |
| cassette/boombox/vinyl/headphones | music nostalgia | Generic hardware, hand-drawn labels with no band names |
| Curb (pigeon) | skate culture | Original animal mascot; GRIND lettering is ours (no Thrasher flame script) |
| traffic cone / road signs | street | Generic; sign text invented |
| Sasquish / moth-friend / UFO | cryptid memes | Folklore creatures are public domain; designs original and cute, no X-Files type/poster layout ("OUT THERE" not "I WANT TO BELIEVE") |
| chrome smiley | Y2K | Smiley is generic (we avoid any specific brand's droop-mouth variant); chrome treatment ours |
| checkerboard flame | Y2K/Vans-era pattern energy | Checks are generic; NOT the Thrasher flame script, no brand lettering |
| flip phone / butterfly clip / CD | Y2K objects | Generic hardware |
| Champ (badger) + W patch | varsity Americana | Original animal; single letter on a patch is generic heraldry; W = Wins, school-neutral |
| Pokéball/tetromino/console-glyph traps | — | **No color-split spheres, no exact tetromino sets, no △○✕□ layouts anywhere in any pack** |

Rule applied throughout: **evoke the genre, never the franchise.** Any future
item that makes someone say "is that—?" gets redesigned before shipping.

## Catalog mechanics

- Items gain `pack` (slug) and `rarity` (`common|foil|holo`); existing v1
  items keep working (`pack: "classics"`, `rarity: "common"`, `weight` field
  retired in favor of rarity but kept for back-compat).
- Store groups by pack with a collected-count chip; items stay individually
  purchasable. No bundles in v1 (a bundle is a price decision, not a
  mechanic — revisit).
- All art = original SVG via `scripts/generate-locker-art.mjs` templates,
  reviewed by Devin before any real class sees it.
