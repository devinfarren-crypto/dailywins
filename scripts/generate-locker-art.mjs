// One-time dev tooling: generates placeholder-but-presentable SVG art for
// every catalog item into public/locker/. Real commissioned art replaces
// files 1:1 later (same paths). Run: node scripts/generate-locker-art.mjs
import fs from "node:fs";
import path from "node:path";

const catalog = JSON.parse(fs.readFileSync("src/lib/locker/catalog-v1.json", "utf8"));
const OUT = "public";

// Glyphs drawn in a 100x100 box, centered.
const GLYPHS = {
  "stk-smiley": `<circle cx="50" cy="50" r="34" fill="#FFD93B"/><circle cx="38" cy="42" r="5" fill="#222"/><circle cx="62" cy="42" r="5" fill="#222"/><path d="M34 58 Q50 74 66 58" stroke="#222" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  "stk-lightning": `<path d="M55 14 L30 56 H46 L40 86 L70 42 H52 Z" fill="#FFC53D" stroke="#B8860B" stroke-width="2"/>`,
  "stk-star-gold": `<path d="M50 14 L59 38 L85 38 L64 54 L72 80 L50 64 L28 80 L36 54 L15 38 L41 38 Z" fill="#F4B942" stroke="#C98A1B" stroke-width="2"/>`,
  "stk-peace": `<circle cx="50" cy="50" r="32" fill="none" stroke="#4A90D9" stroke-width="7"/><path d="M50 18 V82 M50 50 L27 73 M50 50 L73 73" stroke="#4A90D9" stroke-width="7" stroke-linecap="round"/>`,
  "stk-skateboard": `<rect x="18" y="48" width="64" height="10" rx="5" fill="#E2574C"/><circle cx="32" cy="66" r="7" fill="#333"/><circle cx="68" cy="66" r="7" fill="#333"/><path d="M18 53 q-6 -8 2 -12 M82 53 q6 -8 -2 -12" stroke="#E2574C" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  "stk-boombox": `<rect x="16" y="34" width="68" height="40" rx="6" fill="#3B3F4A"/><circle cx="34" cy="54" r="11" fill="#7B8294"/><circle cx="34" cy="54" r="5" fill="#2A2D36"/><circle cx="66" cy="54" r="11" fill="#7B8294"/><circle cx="66" cy="54" r="5" fill="#2A2D36"/><rect x="44" y="40" width="12" height="8" rx="2" fill="#9AE6B4"/><rect x="28" y="26" width="6" height="10" fill="#3B3F4A"/><rect x="66" y="26" width="6" height="10" fill="#3B3F4A"/>`,
  "stk-cassette": `<rect x="18" y="32" width="64" height="40" rx="5" fill="#37445E"/><rect x="26" y="40" width="48" height="14" rx="7" fill="#E8E2D0"/><circle cx="38" cy="47" r="5" fill="#37445E"/><circle cx="62" cy="47" r="5" fill="#37445E"/><rect x="34" y="60" width="32" height="8" rx="2" fill="#2A3349"/>`,
  "stk-controller": `<rect x="16" y="38" width="68" height="30" rx="14" fill="#5A6378"/><path d="M32 47 v12 M26 53 h12" stroke="#EEE" stroke-width="5" stroke-linecap="round"/><circle cx="66" cy="49" r="4.5" fill="#E2574C"/><circle cx="76" cy="56" r="4.5" fill="#3BA776"/>`,
  "stk-pizza": `<path d="M50 86 L22 26 Q50 14 78 26 Z" fill="#F2C063" stroke="#C98A1B" stroke-width="2"/><path d="M26 30 Q50 20 74 30" stroke="#E2574C" stroke-width="8" fill="none"/><circle cx="46" cy="42" r="5" fill="#E2574C"/><circle cx="58" cy="56" r="5" fill="#E2574C"/><circle cx="44" cy="64" r="4" fill="#E2574C"/>`,
  "stk-dice": `<rect x="22" y="30" width="34" height="34" rx="7" fill="#E84D6F" transform="rotate(-8 39 47)"/><circle cx="39" cy="46" r="4" fill="#fff"/><rect x="46" y="40" width="34" height="34" rx="7" fill="#4A90D9" transform="rotate(7 63 57)"/><circle cx="56" cy="50" r="3.4" fill="#fff"/><circle cx="70" cy="64" r="3.4" fill="#fff"/>`,
  "stk-flame": `<path d="M50 14 Q66 36 58 48 Q70 44 70 60 Q70 80 50 84 Q30 80 30 60 Q30 48 40 40 Q36 56 46 56 Q42 34 50 14 Z" fill="#F2742C"/><path d="M50 44 Q58 56 54 66 Q52 74 50 76 Q42 70 44 60 Q46 52 50 44 Z" fill="#FFD93B"/>`,
  "stk-yinyang": `<circle cx="50" cy="50" r="33" fill="#fff" stroke="#222" stroke-width="3"/><path d="M50 17 a33 33 0 0 1 0 66 a16.5 16.5 0 0 1 0 -33 a16.5 16.5 0 0 0 0 -33 Z" fill="#222"/><circle cx="50" cy="33.5" r="5" fill="#fff"/><circle cx="50" cy="66.5" r="5" fill="#222"/>`,
  "stk-eightball": `<circle cx="50" cy="50" r="33" fill="#191B20"/><circle cx="50" cy="42" r="13" fill="#fff"/><text x="50" y="48" font-family="Arial" font-size="17" font-weight="bold" text-anchor="middle" fill="#191B20">8</text>`,
  "stk-holo-star": `<defs><linearGradient id="h1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9BE7FF"/><stop offset=".5" stop-color="#C6A4FF"/><stop offset="1" stop-color="#FFB7E1"/></linearGradient></defs><path d="M50 12 L60 38 L88 38 L65 55 L74 84 L50 66 L26 84 L35 55 L12 38 L40 38 Z" fill="url(#h1)" stroke="#fff" stroke-width="2"/>`,
  "stk-holo-saturn": `<defs><linearGradient id="h2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9BE7FF"/><stop offset=".5" stop-color="#C6A4FF"/><stop offset="1" stop-color="#FFB7E1"/></linearGradient></defs><circle cx="50" cy="50" r="22" fill="url(#h2)"/><ellipse cx="50" cy="54" rx="40" ry="11" fill="none" stroke="url(#h2)" stroke-width="6" transform="rotate(-16 50 54)"/>`,
};

const BUTTON_TEXT = {
  "btn-have-nice-day": { bg: "#FFD93B", fg: "#222", lines: ["HAVE A", "NICE DAY"] },
  "btn-question": { bg: "#222431", fg: "#E8E2D0", lines: ["QUESTION", "EVERYTHING"] },
  "btn-86": { bg: "#3BA776", fg: "#fff", lines: ["CLASS OF", "WHENEVER"] },
  "btn-vinyl": { bg: "#E84D6F", fg: "#fff", lines: ["SPIN", "RECORDS"] },
};

// Pixel art: rows of characters → squares. '.' = empty; letters map to colors.
function pixels(rows, colors, cell = 6, ox = 0, oy = 0) {
  let out = "";
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      out += `<rect x="${ox + x * cell}" y="${oy + y * cell}" width="${cell}" height="${cell}" fill="${colors[ch]}"/>`;
    });
  });
  return out;
}

const FOIL = `<linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8D48B"/><stop offset=".5" stop-color="#C9A227"/><stop offset="1" stop-color="#F4E3A1"/></linearGradient>`;
const HOLO = `<linearGradient id="holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9BE7FF"/><stop offset=".5" stop-color="#C6A4FF"/><stop offset="1" stop-color="#FFB7E1"/></linearGradient>`;

// ── Arcade pack (pixel grids, centered in the 100×100 die-cut) ──────────────
const PX = {
  "stk-px-heart": pixels(
    [".RR.RR.", "RRRRRRR", "RRRRRRR", ".RRRRR.", "..RRR..", "...R..."],
    { R: "#E8485C" }, 8, 22, 28
  ),
  "stk-px-sword": pixels(
    ["......B", ".....BB", "....BB.", "...BB..", "Y.BB...", ".YY....", "YYG....", "G.Y...."],
    { B: "#AFC6D9", Y: "#E8B23A", G: "#7A4E22" }, 8, 22, 18
  ),
  // Arcade panel: angled stick with ball top-left, two buttons on the deck —
  // reads as a control panel, not... anything else.
  "stk-px-joystick": pixels(
    [
      ".RR.......",
      "RRRR......",
      "RRRR......",
      ".GG.......",
      ".GG.Y..B..",
      "DDDDDDDDDD",
      "DDDDDDDDDD",
    ],
    { R: "#E8485C", G: "#8A93A6", D: "#23262E", Y: "#FFD23B", B: "#4A90D9" }, 7, 16, 26
  ),
  "stk-px-healthbar": pixels(
    ["OOOOOOOOOO", "OGGGGGGGGO", "OGGGGGGGGO", "OOOOOOOOOO"],
    { O: "#23262E", G: "#3BD27A" }, 7, 15, 38
  ),
  "stk-px-levelup": pixels(
    ["...FF...", "..FFFF..", ".FFFFFF.", "FFFFFFFF", "..FFFF..", "..FFFF..", "..FFFF.."],
    { F: "url(#foil)" }, 8, 18, 20
  ),
  "stk-px-bitt": pixels(
    [".HHHH.", "HHHHHH", "HWWHHH", "HWBHHH", "HHHHHH", ".HHHH.", ".F..F."],
    { H: "url(#holo)", W: "#fff", B: "#1c2030", F: "#1c2030" }, 8, 24, 18
  ),
};

const ARCADE_TEXT = {
  "stk-px-highscore": { lines: ["HIGH", "SCORE"], bg: "#1c2030", fg: "#FFD23B" },
  "stk-px-coin": { lines: ["INSERT", "COIN"], bg: "#1c2030", fg: "#3BD27A" },
};

// ── Mixtape pack ─────────────────────────────────────────────────────────────
const MIXTAPE = {
  "stk-mx-headphones": `<path d="M26 58 a24 24 0 0 1 48 0" stroke="#2A2D36" stroke-width="11" fill="none"/><rect x="17" y="50" width="17" height="28" rx="8" fill="#2A2D36"/><rect x="21" y="55" width="9" height="18" rx="4.5" fill="#E8485C"/><rect x="66" y="50" width="17" height="28" rx="8" fill="#2A2D36"/><rect x="70" y="55" width="9" height="18" rx="4.5" fill="#E8485C"/>`,
  "stk-mx-vinyl": `<circle cx="50" cy="50" r="33" fill="#191B20"/><circle cx="50" cy="50" r="32" fill="none" stroke="#2E323C" stroke-width="2" stroke-dasharray="1 3"/><circle cx="50" cy="50" r="22" fill="none" stroke="#2E323C" stroke-width="1.4"/><circle cx="50" cy="50" r="11" fill="#E8B23A"/><circle cx="50" cy="50" r="3" fill="#191B20"/>`,
  "stk-mx-nowplaying": null, // text card below
  "stk-mx-noskips": null,
  "stk-mx-eq": `<g fill="url(#foil)">${[14, 30, 46, 62, 78].map((x, i) => `<rect x="${x}" y="${[44, 28, 36, 22, 40][i]}" width="10" height="${[34, 50, 42, 56, 38][i]}" rx="3"/>`).join("")}</g>`,
  "stk-mx-demi": `<g fill="url(#holo)"><ellipse cx="38" cy="66" rx="13" ry="10"/><rect x="47" y="22" width="7" height="46" rx="3"/><path d="M54 22 q20 4 16 20 q-2 -10 -16 -10 Z"/></g><circle cx="34" cy="63" r="2.6" fill="#1c2030"/><circle cx="44" cy="63" r="2.6" fill="#1c2030"/><path d="M35 70 q4 4 8 0" stroke="#1c2030" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="28" y="78" width="10" height="5" rx="2.5" fill="#fff" stroke="#1c2030" stroke-width="1.5"/><rect x="40" y="78" width="10" height="5" rx="2.5" fill="#fff" stroke="#1c2030" stroke-width="1.5"/>`,
};

const MIX_TEXT = {
  "stk-mx-nowplaying": { lines: ["▶ NOW", "PLAYING"], bg: "#16324F", fg: "#9BE7FF" },
  "stk-mx-noskips": { lines: ["NO", "SKIPS"], bg: "#E8485C", fg: "#fff" },
};

// ── Packs 3–7 (sticker-packs.md) — detailed glyphs, gradient shading. SVGs
// are resolution-independent; "high definition" = richer linework, and each
// renders once as an <img>, so Chromebook cost is unchanged. ──────────────────
const PACKS = {
  // Side Quest — RPG/fantasy
  "stk-sq-d20": `<defs><linearGradient id="d20g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A5CD6"/><stop offset="1" stop-color="#4A2F96"/></linearGradient></defs>` +
    `<path d="M50 14 L81 32 L81 66 L50 86 L19 66 L19 32 Z" fill="url(#d20g)" stroke="#2E1D63" stroke-width="2.5"/>` +
    `<path d="M50 14 L72 44 L50 86 L28 44 Z" fill="#8B6FE0" stroke="#2E1D63" stroke-width="1.6"/>` +
    `<path d="M19 32 L28 44 M81 32 L72 44 M19 66 L28 44 M81 66 L72 44" stroke="#2E1D63" stroke-width="1.6"/>` +
    `<text x="50" y="52" font-family="Georgia" font-size="17" font-weight="bold" text-anchor="middle" fill="#fff">20</text>`,
  "stk-sq-potion": `<defs><radialGradient id="potg" cx=".4" cy=".35" r=".9"><stop offset="0" stop-color="#FF8FC2"/><stop offset="1" stop-color="#D6347F"/></radialGradient></defs>` +
    `<rect x="44" y="16" width="12" height="14" fill="#B8C4D4" rx="2"/><rect x="41" y="13" width="18" height="6" rx="3" fill="#8A6B4D"/>` +
    `<path d="M44 30 q-18 12 -18 30 a24 24 0 0 0 48 0 q0 -18 -18 -30 Z" fill="#DCEAF5" opacity=".5" stroke="#9FB4C8" stroke-width="2.5"/>` +
    `<path d="M30 54 q3 -8 10 -13 q-14 9 -10 13 Z M28 60 a22 22 0 0 0 44 0 q0 -8 -5 -14 q-16 10 -34 2 q-5 6 -5 12 Z" fill="url(#potg)"/>` +
    `<circle cx="58" cy="64" r="3.4" fill="#FFC2DE"/><circle cx="46" cy="72" r="2.4" fill="#FFC2DE"/><ellipse cx="40" cy="42" rx="4" ry="7" fill="#fff" opacity=".55" transform="rotate(18 40 42)"/>`,
  "stk-sq-chest": `<defs><linearGradient id="chw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A6633"/><stop offset="1" stop-color="#6E4520"/></linearGradient></defs>` +
    `<path d="M22 44 q28 -22 56 0 l0 8 -56 0 Z" fill="url(#chw)" stroke="#4A2D12" stroke-width="2.5"/>` +
    `<rect x="22" y="52" width="56" height="28" rx="4" fill="url(#chw)" stroke="#4A2D12" stroke-width="2.5"/>` +
    `<path d="M26 47 q24 -17 48 0" stroke="#4A2D12" stroke-width="1.6" fill="none"/>` +
    `<path d="M24 50 h52 M24 66 h52" stroke="#E8B23A" stroke-width="3.4"/><rect x="44" y="46" width="12" height="16" rx="2.5" fill="#E8B23A" stroke="#8a6310" stroke-width="1.6"/><circle cx="50" cy="53" r="2.4" fill="#6E4520"/>` +
    `<circle cx="33" cy="42" r="2.6" fill="#FFD23B"/><circle cx="62" cy="39" r="2.2" fill="#FFD23B"/><circle cx="48" cy="36" r="1.8" fill="#FFE48A"/>`,
  "stk-sq-xpbar": `<rect x="14" y="38" width="72" height="22" rx="11" fill="#1F2433" stroke="#0E1119" stroke-width="2.5"/>` +
    `<rect x="18" y="42" width="44" height="14" rx="7" fill="#3BD27A"/><rect x="18" y="42" width="44" height="6" rx="3" fill="#7CE8AB" opacity=".7"/>` +
    `<text x="50" y="76" font-family="'Courier New', monospace" font-weight="bold" font-size="12" text-anchor="middle" fill="#3BD27A">XP +50</text>`,
  "stk-sq-scroll": `<defs><linearGradient id="scrg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E6C2"/><stop offset="1" stop-color="#DCC793"/></linearGradient></defs>` +
    `<rect x="28" y="20" width="44" height="60" rx="3" fill="url(#scrg)" stroke="#A88D52" stroke-width="2"/>` +
    `<rect x="24" y="14" width="52" height="10" rx="5" fill="#C9AE74" stroke="#A88D52" stroke-width="1.6"/><rect x="24" y="76" width="52" height="10" rx="5" fill="#C9AE74" stroke="#A88D52" stroke-width="1.6"/>` +
    `<text x="50" y="52" font-family="Georgia" font-size="24" font-weight="bold" text-anchor="middle" fill="#9c3a22">!</text>` +
    `<path d="M35 60 h30 M35 66 h22" stroke="#B49A60" stroke-width="2" stroke-linecap="round"/>`,
  "stk-sq-crit": `<path d="M50 10 L57 36 L84 28 L64 48 L88 62 L60 60 L64 88 L48 64 L28 84 L36 56 L12 52 L36 44 Z" fill="url(#foil)" stroke="#8a6310" stroke-width="2"/>` +
    `<text x="50" y="48" font-family="Arial Black, Arial" font-weight="900" font-size="10.5" text-anchor="middle" fill="#4A2F08">CRIT</text>` +
    `<text x="50" y="60" font-family="Arial Black, Arial" font-weight="900" font-size="10.5" text-anchor="middle" fill="#4A2F08">HIT!</text>`,
  "stk-sq-glorp": `<defs><radialGradient id="glo" cx=".4" cy=".3" r="1"><stop offset="0" stop-color="#D8C2FF"/><stop offset=".55" stop-color="#A47CF0"/><stop offset="1" stop-color="#7C4FD0"/></radialGradient></defs>` +
    `<path d="M24 66 q0 -34 26 -34 q26 0 26 34 q0 12 -26 12 q-26 0 -26 -12 Z" fill="url(#glo)" stroke="#4A2F96" stroke-width="2.2"/>` +
    `<ellipse cx="38" cy="44" rx="6" ry="9" fill="#fff" opacity=".5"/>` +
    `<circle cx="42" cy="56" r="3.4" fill="#2E1D63"/><circle cx="58" cy="56" r="3.4" fill="#2E1D63"/><path d="M44 66 q6 5 12 0" stroke="#2E1D63" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<path d="M74 38 l8 -14 M82 24 l3.5 6 M82 24 l-6.5 -2" stroke="#AFC6D9" stroke-width="3.6" stroke-linecap="round"/><rect x="70" y="36" width="9" height="5" rx="2.5" fill="#8A6B4D" transform="rotate(-60 74 38)"/>`,
  // Kickflip — skate/street
  "stk-kf-cone": `<defs><linearGradient id="cone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF8A3D"/><stop offset=".5" stop-color="#F2632C"/><stop offset="1" stop-color="#D44E1E"/></linearGradient></defs>` +
    `<path d="M50 16 L68 76 H32 Z" fill="url(#cone)" stroke="#A33B14" stroke-width="2"/>` +
    `<path d="M42.5 42 h15 l2.6 9 h-20.2 Z M38.5 58 h23 l2.6 9 h-28.2 Z" fill="#F4F0E4"/>` +
    `<rect x="22" y="74" width="56" height="9" rx="4.5" fill="#D44E1E" stroke="#A33B14" stroke-width="2"/>`,
  "stk-kf-grind": `<rect x="10" y="30" width="80" height="40" rx="8" fill="#16181F"/>` +
    `<text x="50" y="57" font-family="Georgia" font-style="italic" font-weight="bold" font-size="19" text-anchor="middle" fill="url(#foil)" letter-spacing="1">GRIND</text>` +
    `<path d="M16 64 h68" stroke="url(#foil)" stroke-width="2.4"/>`,
  "stk-kf-helmet": `<defs><linearGradient id="helg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4E586E"/><stop offset="1" stop-color="#343C4E"/></linearGradient></defs>` +
    `<path d="M22 56 a28 28 0 0 1 56 0 l0 6 q-28 8 -56 0 Z" fill="url(#helg)" stroke="#1E2330" stroke-width="2.5"/>` +
    `<ellipse cx="38" cy="40" rx="9" ry="6" fill="#fff" opacity=".22" transform="rotate(-18 38 40)"/>` +
    `<path d="M30 47 l10 -5 M64 38 l6 7" stroke="#1E2330" stroke-width="2" opacity=".7"/>` +
    `<rect x="30" y="60" width="40" height="7" rx="3.5" fill="#E8B23A"/><path d="M44 67 q6 10 12 0" stroke="#1E2330" stroke-width="3" fill="none"/>` +
    `<circle cx="55" cy="50" r="4" fill="#E8485C" opacity=".85"/><rect x="62" y="52" width="9" height="6" rx="2" fill="#3BA776" transform="rotate(12 66 55)"/>`,
  "stk-kf-sign": `<rect x="24" y="18" width="52" height="52" rx="8" fill="#FFD23B" stroke="#1E2330" stroke-width="3" transform="rotate(45 50 44)"/>` +
    `<text x="50" y="42" font-family="Arial" font-weight="bold" font-size="10.5" text-anchor="middle" fill="#1E2330">SKATE</text>` +
    `<text x="50" y="54" font-family="Arial" font-weight="bold" font-size="10.5" text-anchor="middle" fill="#1E2330">ZONE</text>` +
    `<rect x="46.5" y="72" width="7" height="16" fill="#8A93A6"/>`,
  "stk-kf-shield": `<defs><linearGradient id="shg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A90D9"/><stop offset="1" stop-color="#2E6AAB"/></linearGradient></defs>` +
    `<path d="M50 14 q20 8 30 6 q0 42 -30 64 q-30 -22 -30 -64 q20 2 30 -6 Z" fill="url(#shg)" stroke="#1C4470" stroke-width="2.5"/>` +
    `<path d="M34 34 l10 8 M68 52 l-7 6" stroke="#1C4470" stroke-width="2.4" opacity=".7"/>` +
    `<text x="50" y="50" font-family="Arial" font-weight="bold" font-size="11" text-anchor="middle" fill="#fff">RIDE</text>` +
    `<text x="50" y="63" font-family="Arial" font-weight="bold" font-size="11" text-anchor="middle" fill="#fff">ON</text>`,
  "stk-kf-wheels": `<defs><radialGradient id="whe" cx=".4" cy=".35" r="1"><stop offset="0" stop-color="#FFF6D8"/><stop offset="1" stop-color="#E8C23A"/></radialGradient></defs>` +
    `<circle cx="36" cy="50" r="20" fill="url(#whe)" stroke="#B8901E" stroke-width="2.4"/><circle cx="36" cy="50" r="8" fill="#D8D2BF" stroke="#9a8c66" stroke-width="2"/><circle cx="36" cy="50" r="2.6" fill="#6b6147"/>` +
    `<circle cx="66" cy="56" r="20" fill="url(#whe)" stroke="#B8901E" stroke-width="2.4"/><circle cx="66" cy="56" r="8" fill="#D8D2BF" stroke="#9a8c66" stroke-width="2"/><circle cx="66" cy="56" r="2.6" fill="#6b6147"/>`,
  "stk-kf-curb": `<rect x="20" y="68" width="60" height="8" rx="4" fill="url(#holo)"/><circle cx="33" cy="80" r="5" fill="#1c2030"/><circle cx="67" cy="80" r="5" fill="#1c2030"/>` +
    `<g fill="url(#holo)"><ellipse cx="50" cy="52" rx="15" ry="13"/><circle cx="50" cy="34" r="9"/></g>` +
    `<path d="M57 32 l9 -2 -8 5 Z" fill="#F2974B"/><circle cx="52.5" cy="32" r="2" fill="#1c2030"/>` +
    `<path d="M44 64 l-3 5 M56 64 l3 5" stroke="#F2974B" stroke-width="3" stroke-linecap="round"/>`,
  // Cryptid Club — spooky-lite
  "stk-cc-ufo": `<defs><linearGradient id="ufo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8D4E4"/><stop offset="1" stop-color="#7E8CA4"/></linearGradient></defs>` +
    `<path d="M50 64 L34 88 M50 64 L66 88 M50 64 L50 90" stroke="#8FE3C0" stroke-width="3" opacity=".6" stroke-linecap="round"/>` +
    `<ellipse cx="50" cy="52" rx="34" ry="12" fill="url(#ufo)" stroke="#4A5468" stroke-width="2.4"/>` +
    `<path d="M32 46 a18 14 0 0 1 36 0 q-18 8 -36 0 Z" fill="#8FE3C0" opacity=".85" stroke="#4A5468" stroke-width="2"/>` +
    `<circle cx="34" cy="54" r="2.6" fill="#FFD23B"/><circle cx="50" cy="57" r="2.6" fill="#FFD23B"/><circle cx="66" cy="54" r="2.6" fill="#FFD23B"/>`,
  "stk-cc-outthere": `<rect x="22" y="14" width="56" height="72" rx="3" fill="#10131E" stroke="#2A3148" stroke-width="2.5"/>` +
    `<circle cx="50" cy="38" r="11" fill="none" stroke="#8FE3C0" stroke-width="2"/><ellipse cx="50" cy="41" rx="17" ry="4.5" fill="none" stroke="#8FE3C0" stroke-width="1.6" transform="rotate(-14 50 41)"/>` +
    `<text x="50" y="64" font-family="'Courier New', monospace" font-weight="bold" font-size="10" text-anchor="middle" fill="#E7E9F0">OUT</text>` +
    `<text x="50" y="76" font-family="'Courier New', monospace" font-weight="bold" font-size="10" text-anchor="middle" fill="#E7E9F0">THERE</text>`,
  "stk-cc-moth": `<g fill="url(#foil)" stroke="#8a6310" stroke-width="1.6"><ellipse cx="32" cy="46" rx="17" ry="21" transform="rotate(18 32 46)"/><ellipse cx="68" cy="46" rx="17" ry="21" transform="rotate(-18 68 46)"/></g>` +
    `<circle cx="32" cy="44" r="5" fill="#4A2F08" opacity=".5"/><circle cx="68" cy="44" r="5" fill="#4A2F08" opacity=".5"/>` +
    `<ellipse cx="50" cy="56" rx="8" ry="17" fill="#6B5A3A"/><circle cx="50" cy="38" r="7" fill="#6B5A3A"/>` +
    `<circle cx="47" cy="36" r="2.2" fill="#fff"/><circle cx="53" cy="36" r="2.2" fill="#fff"/>` +
    `<path d="M46 32 q-4 -7 -8 -8 M54 32 q4 -7 8 -8" stroke="#6B5A3A" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  "stk-cc-flashlight": `<rect x="18" y="44" width="34" height="14" rx="7" fill="#3A4152" stroke="#1E2330" stroke-width="2"/>` +
    `<rect x="50" y="40" width="12" height="22" rx="3" fill="#4E586E" stroke="#1E2330" stroke-width="2"/>` +
    `<path d="M62 40 L88 26 L88 76 L62 62 Z" fill="#FFE48A" opacity=".85"/>` +
    `<rect x="24" y="48" width="10" height="6" rx="3" fill="#E8485C"/>`,
  "stk-cc-footprint": `<circle cx="50" cy="50" r="36" fill="#C9BBA4" stroke="#9a8c66" stroke-width="2.4"/>` +
    `<path d="M44 38 q6 -10 13 -2 q6 7 1 22 q-3 12 -11 10 q-9 -2 -8 -14 q1 -10 5 -16 Z" fill="#8A7A5C"/>` +
    `<circle cx="42" cy="30" r="3.4" fill="#8A7A5C"/><circle cx="50" cy="27" r="3.6" fill="#8A7A5C"/><circle cx="58" cy="29" r="3.2" fill="#8A7A5C"/><circle cx="64" cy="34" r="2.8" fill="#8A7A5C"/>` +
    `<text x="50" y="82" font-family="'Courier New', monospace" font-size="8.5" font-weight="bold" text-anchor="middle" fill="#6b6147">EXHIBIT A</text>`,
  "stk-cc-polaroid": `<g transform="rotate(-5 50 50)"><rect x="24" y="18" width="52" height="62" fill="#F4F0E4" stroke="#C9C2AC" stroke-width="1.6"/>` +
    `<rect x="29" y="23" width="42" height="42" fill="#1B2330"/>` +
    `<path d="M36 56 q8 -16 14 -10 q5 5 4 10 Z" fill="#2E3A4E"/><circle cx="58" cy="34" r="4" fill="#3E4E68"/>` +
    `<text x="50" y="48" font-family="Georgia" font-size="17" font-weight="bold" text-anchor="middle" fill="#8FE3C0">?</text>` +
    `<text x="50" y="75" font-family="Georgia" font-style="italic" font-size="8" text-anchor="middle" fill="#6b6147">no way...</text></g>`,
  "stk-cc-isawit": `<circle cx="50" cy="50" r="36" fill="#1E4438" stroke="#0F2820" stroke-width="3"/>` +
    `<circle cx="50" cy="50" r="30" fill="none" stroke="#8FE3C0" stroke-width="1.6" stroke-dasharray="4 3"/>` +
    `<text x="50" y="46" font-family="Arial" font-weight="bold" font-size="11" text-anchor="middle" fill="#8FE3C0">I SAW</text>` +
    `<text x="50" y="60" font-family="Arial" font-weight="bold" font-size="11" text-anchor="middle" fill="#8FE3C0">IT</text>`,
  "stk-cc-sasquish": `<g fill="url(#holo)"><ellipse cx="50" cy="58" rx="22" ry="26"/><circle cx="50" cy="32" r="13"/><circle cx="26" cy="52" r="6"/><circle cx="74" cy="48" r="6"/></g>` +
    `<ellipse cx="50" cy="34" rx="8" ry="6" fill="#F4E8FF"/><circle cx="47" cy="32" r="2" fill="#1c2030"/><circle cx="53" cy="32" r="2" fill="#1c2030"/><path d="M47 37 q3 2.5 6 0" stroke="#1c2030" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M74 44 q6 -6 4 -12" stroke="#C6A4FF" stroke-width="4" stroke-linecap="round" fill="none"/>` +
    `<ellipse cx="42" cy="84" rx="7" ry="4" fill="url(#holo)"/><ellipse cx="58" cy="84" rx="7" ry="4" fill="url(#holo)"/>`,
  // Y2K — vaporwave
  "stk-yk-smiley": `<circle cx="50" cy="50" r="34" fill="url(#foil)" stroke="#8a6310" stroke-width="2"/>` +
    `<ellipse cx="38" cy="36" rx="11" ry="6" fill="#fff" opacity=".5" transform="rotate(-16 38 36)"/>` +
    `<circle cx="38" cy="44" r="4.4" fill="#3A2C08"/><circle cx="62" cy="44" r="4.4" fill="#3A2C08"/>` +
    `<path d="M34 60 Q50 74 66 60" stroke="#3A2C08" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
  "stk-yk-flipphone": `<defs><linearGradient id="fph" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E48FD0"/><stop offset="1" stop-color="#B554A0"/></linearGradient></defs>` +
    `<rect x="34" y="14" width="32" height="34" rx="6" fill="url(#fph)" stroke="#7A3068" stroke-width="2"/><rect x="39" y="20" width="22" height="20" rx="3" fill="#BFE8DC"/>` +
    `<rect x="34" y="50" width="32" height="36" rx="6" fill="url(#fph)" stroke="#7A3068" stroke-width="2"/>` +
    [0, 1, 2].map((r) => [0, 1, 2].map((c) => `<rect x="${40 + c * 7.4}" y="${56 + r * 8}" width="5.4" height="5.4" rx="1.6" fill="#F4D8EE"/>`).join("")).join("") +
    `<rect x="44" y="46" width="12" height="6" rx="3" fill="#7A3068"/><circle cx="62" cy="12" r="3" fill="#7A3068"/><rect x="60.5" y="10" width="3" height="8" fill="#7A3068"/>`,
  "stk-yk-butterfly": `<defs><linearGradient id="bfy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9BE7FF"/><stop offset="1" stop-color="#5FB4E8"/></linearGradient></defs>` +
    `<g fill="url(#bfy)" stroke="#2E6AAB" stroke-width="2"><path d="M46 50 Q20 22 28 46 Q32 58 46 54 Z"/><path d="M54 50 Q80 22 72 46 Q68 58 54 54 Z"/><path d="M46 54 Q26 80 34 64 Q38 56 46 56 Z"/><path d="M54 54 Q74 80 66 64 Q62 56 54 56 Z"/></g>` +
    `<rect x="46.5" y="42" width="7" height="22" rx="3.5" fill="#2E6AAB"/><path d="M48 42 q-3 -7 -7 -9 M52 42 q3 -7 7 -9" stroke="#2E6AAB" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  "stk-yk-checkflame": `<path d="M50 12 Q68 36 60 48 Q73 44 73 62 Q73 84 50 88 Q27 84 27 62 Q27 47 38 39 Q34 56 45 56 Q40 32 50 12 Z" fill="#16181F"/>` +
    `<clipPath id="ckf"><path d="M50 12 Q68 36 60 48 Q73 44 73 62 Q73 84 50 88 Q27 84 27 62 Q27 47 38 39 Q34 56 45 56 Q40 32 50 12 Z"/></clipPath>` +
    `<g clip-path="url(#ckf)">` +
    Array.from({ length: 10 }, (_, r) => Array.from({ length: 8 }, (_, c) => ((r + c) % 2 === 0 ? `<rect x="${22 + c * 8}" y="${10 + r * 8}" width="8" height="8" fill="#F4F0E4"/>` : "")).join("")).join("") +
    `</g>`,
  "stk-yk-vibes": `<defs><linearGradient id="vbs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E48FD0"/><stop offset=".5" stop-color="#9BE7FF"/><stop offset="1" stop-color="#B7A4FF"/></linearGradient></defs>` +
    `<text x="50" y="62" font-family="Arial Rounded MT Bold, Arial" font-weight="bold" font-size="30" text-anchor="middle" fill="url(#vbs)" stroke="#fff" stroke-width="1" letter-spacing="1">vibes</text>` +
    `<circle cx="22" cy="36" r="3" fill="#E48FD0"/><circle cx="80" cy="34" r="2.4" fill="#9BE7FF"/><circle cx="74" cy="70" r="2.6" fill="#B7A4FF"/>`,
  "stk-yk-sparkle": `<defs><linearGradient id="spk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#C8D4E4"/></linearGradient></defs>` +
    `<path d="M50 18 L56 44 L82 50 L56 56 L50 82 L44 56 L18 50 L44 44 Z" fill="url(#spk)" stroke="#8FA4C4" stroke-width="1.6"/>` +
    `<path d="M74 22 L77 32 L87 35 L77 38 L74 48 L71 38 L61 35 L71 32 Z" fill="url(#spk)" stroke="#8FA4C4" stroke-width="1.2"/>` +
    `<path d="M28 64 L30.4 72 L38 74.4 L30.4 77 L28 85 L25.6 77 L18 74.4 L25.6 72 Z" fill="url(#spk)" stroke="#8FA4C4" stroke-width="1.2"/>`,
  "stk-yk-sun": `<defs><radialGradient id="wsn" cx=".42" cy=".4" r=".9"><stop offset="0" stop-color="#FFE48A"/><stop offset="1" stop-color="#F2A93B"/></radialGradient></defs>` +
    `<circle cx="50" cy="50" r="20" fill="url(#wsn)" stroke="#C97E16" stroke-width="2"/>` +
    Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      const x1 = 50 + Math.cos(a) * 25, y1 = 50 + Math.sin(a) * 25;
      const x2 = 50 + Math.cos(a + 0.22) * 36, y2 = 50 + Math.sin(a + 0.22) * 36;
      const x3 = 50 + Math.cos(a + 0.44) * 25, y3 = 50 + Math.sin(a + 0.44) * 25;
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${x2.toFixed(1)} ${y2.toFixed(1)} ${x3.toFixed(1)} ${y3.toFixed(1)}" fill="none" stroke="#F2A93B" stroke-width="3.4" stroke-linecap="round"/>`;
    }).join("") +
    `<circle cx="44" cy="48" r="2.6" fill="#7A4E16"/><circle cx="56" cy="48" r="2.6" fill="#7A4E16"/><path d="M44 56 q6 5 12 0" stroke="#7A4E16" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  "stk-yk-disco": `<circle cx="50" cy="46" r="26" fill="url(#holo)" stroke="#fff" stroke-width="2"/>` +
    `<circle cx="50" cy="46" r="8" fill="#fff"/><circle cx="50" cy="46" r="3.4" fill="#1c2030"/>` +
    `<path d="M30 36 a26 26 0 0 1 10 -9 M66 64 a26 26 0 0 0 8 -10" stroke="#fff" stroke-width="2.4" opacity=".7" fill="none"/>` +
    `<circle cx="42" cy="40" r="2.6" fill="#1c2030"/><circle cx="58" cy="40" r="2.6" fill="#1c2030"/>` +
    `<path d="M40 74 l-2 12 M60 74 l2 12" stroke="#1c2030" stroke-width="3.4" stroke-linecap="round"/>` +
    `<rect x="32" y="84" width="11" height="5" rx="2.5" fill="#E48FD0"/><rect x="57" y="84" width="11" height="5" rx="2.5" fill="#9BE7FF"/>`,
  // Varsity
  "stk-vs-wpatch": `<defs><linearGradient id="wpt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a3535"/><stop offset="1" stop-color="#6E2424"/></linearGradient></defs>` +
    `<rect x="22" y="22" width="56" height="56" rx="10" fill="url(#wpt)" stroke="#4A1414" stroke-width="2.4"/>` +
    `<rect x="27" y="27" width="46" height="46" rx="7" fill="none" stroke="#F4E8C8" stroke-width="2" stroke-dasharray="5 3"/>` +
    `<text x="50" y="63" font-family="Georgia" font-weight="bold" font-size="34" text-anchor="middle" fill="#F4E8C8">W</text>`,
  "stk-vs-foam": `<defs><linearGradient id="ffg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9D52"/><stop offset="1" stop-color="#F2742C"/></linearGradient></defs>` +
    `<path d="M40 30 q0 -12 9 -12 q9 0 9 12 l0 12 q14 -4 14 8 l0 18 q0 16 -20 16 l-8 0 q-12 0 -12 -14 l0 -28 q0 -8 8 -12 Z" fill="url(#ffg)" stroke="#B84E12" stroke-width="2.4"/>` +
    `<text x="52" y="72" font-family="Arial" font-weight="bold" font-size="12" text-anchor="middle" fill="#fff">#1</text>`,
  "stk-vs-megaphone": `<defs><linearGradient id="mgp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E8485C"/><stop offset="1" stop-color="#C42B3F"/></linearGradient></defs>` +
    `<path d="M26 44 L70 26 L70 74 L26 56 Z" fill="url(#mgp)" stroke="#8a1c2c" stroke-width="2.4"/>` +
    `<rect x="70" y="22" width="8" height="56" rx="4" fill="#8a1c2c"/>` +
    `<rect x="18" y="44" width="10" height="12" rx="3" fill="#3A4152"/><path d="M30 60 l-4 16 8 0 3 -13 Z" fill="#3A4152"/>` +
    `<path d="M84 36 l8 -5 M86 50 h9 M84 64 l8 5" stroke="#E8B23A" stroke-width="3" stroke-linecap="round"/>`,
  "stk-vs-pennant": `<path d="M22 26 L84 46 L22 66 Z" fill="#2F5243" stroke="#1C3328" stroke-width="2.4"/>` +
    `<rect x="18" y="20" width="6" height="60" rx="3" fill="#8A6B4D"/>` +
    `<text x="44" y="50" font-family="Arial" font-weight="bold" font-size="10" fill="#F4E8C8" transform="rotate(9 44 50)">WINS</text>`,
  "stk-vs-mvp": `<circle cx="50" cy="46" r="28" fill="url(#foil)" stroke="#8a6310" stroke-width="2.4"/>` +
    `<circle cx="50" cy="46" r="22" fill="none" stroke="#8a6310" stroke-width="1.4"/>` +
    `<text x="50" y="53" font-family="Georgia" font-weight="bold" font-size="16" text-anchor="middle" fill="#4A2F08">MVP</text>` +
    `<path d="M38 70 l-6 18 8 -5 4 8 6 -16 M62 70 l6 18 -8 -5 -4 8 -6 -16" fill="#C42B3F" stroke="#8a1c2c" stroke-width="1.6"/>`,
  "stk-vs-whistle": `<defs><linearGradient id="whi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D8DEE8"/><stop offset="1" stop-color="#9AA4B2"/></linearGradient></defs>` +
    `<path d="M30 42 h26 a16 16 0 1 1 -14 24 l-12 -10 q-6 -6 0 -14 Z" fill="url(#whi)" stroke="#5E6878" stroke-width="2.4"/>` +
    `<circle cx="58" cy="54" r="5" fill="#3A4152"/><rect x="30" y="36" width="10" height="8" rx="3" fill="#5E6878"/>` +
    `<path d="M34 34 q-8 -12 -2 -20" stroke="#C42B3F" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  "stk-vs-ticket": `<g transform="rotate(-6 50 50)"><path d="M18 36 h64 a6 6 0 0 0 0 12 v8 a6 6 0 0 0 0 12 h-64 a6 6 0 0 0 0 -12 v-8 a6 6 0 0 0 0 -12 Z" fill="#F4E8C8" stroke="#B49A60" stroke-width="2"/>` +
    `<path d="M64 38 v28" stroke="#B49A60" stroke-width="1.6" stroke-dasharray="3 3"/>` +
    `<text x="42" y="50" font-family="Arial" font-weight="bold" font-size="9" text-anchor="middle" fill="#6E2424">BIG GAME</text>` +
    `<text x="42" y="61" font-family="Arial" font-size="7.5" text-anchor="middle" fill="#8A7A5C">SECTION W</text>` +
    `<text x="73" y="56" font-family="Arial" font-weight="bold" font-size="8" text-anchor="middle" fill="#6E2424" transform="rotate(90 73 53)">ADMIT 1</text></g>`,
  "stk-vs-champ": `<g fill="url(#holo)"><ellipse cx="50" cy="60" rx="20" ry="22"/><circle cx="50" cy="32" r="12"/><circle cx="40" cy="22" r="4"/><circle cx="60" cy="22" r="4"/></g>` +
    `<path d="M44 28 q6 -5 12 0 l-2 7 q-4 3 -8 0 Z" fill="#F4F0E4"/><circle cx="46" cy="31" r="2" fill="#1c2030"/><circle cx="54" cy="31" r="2" fill="#1c2030"/><ellipse cx="50" cy="36" rx="2.4" ry="1.8" fill="#1c2030"/>` +
    `<path d="M36 50 h28 l-2 8 h-24 Z" fill="#6E2424"/><text x="50" y="57" font-family="Georgia" font-weight="bold" font-size="8" text-anchor="middle" fill="#F4E8C8">W</text>` +
    `<path d="M30 78 q-4 6 2 8 M70 78 q4 6 -2 8" stroke="#C6A4FF" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
};

// Unicorns & Rainbows — pastel, sparkly, gradient-rich. Same die-cut style.
const RAINBOW_STOPS = ["#FF8FA3", "#FFB86C", "#FFE66D", "#8FE39A", "#6CC8FF", "#B79CFF"];
Object.assign(PACKS, {
  "stk-un-rainbow":
    `<defs><clipPath id="rbclip"><path d="M14 70 a36 36 0 0 1 72 0 l-12 0 a24 24 0 0 0 -48 0 Z"/></clipPath></defs>` +
    RAINBOW_STOPS.map((c, i) => `<path d="M${14 + i * 6} 70 a${36 - i * 6} ${36 - i * 6} 0 0 1 ${(36 - i * 6) * 2} 0 l-6 0 a${30 - i * 6} ${30 - i * 6} 0 0 0 ${-(30 - i * 6) * 2} 0 Z" fill="${c}"/>`).join("") +
    `<ellipse cx="20" cy="72" rx="9" ry="6" fill="#fff"/><ellipse cx="80" cy="72" rx="9" ry="6" fill="#fff"/>` +
    `<circle cx="74" cy="30" r="3" fill="#FFE66D"/><circle cx="26" cy="28" r="2.4" fill="#FFB7E1"/>`,
  "stk-un-unicorn":
    `<defs><linearGradient id="unmane" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FA3"/><stop offset=".5" stop-color="#B79CFF"/><stop offset="1" stop-color="#6CC8FF"/></linearGradient></defs>` +
    // head + muzzle
    `<path d="M40 80 q-10 -14 -6 -30 q4 -18 22 -22 q16 -3 22 8 q5 8 1 16 l-6 26 q-2 8 -10 8 Z" fill="#FFF7FB" stroke="#E6C6E0" stroke-width="2"/>` +
    // horn
    `<path d="M58 26 l6 -20 4 20 Z" fill="url(#foil)" stroke="#D9A93A" stroke-width="1.4"/>` +
    // ear
    `<path d="M44 30 l-4 -12 10 8 Z" fill="#FFF7FB" stroke="#E6C6E0" stroke-width="1.6"/>` +
    // mane
    `<path d="M48 22 q-18 6 -16 30 q6 -10 12 -10 q-8 10 -4 22 q6 -12 12 -12 q-4 12 2 20 q4 -14 12 -16 Z" fill="url(#unmane)"/>` +
    // eye + cheek
    `<circle cx="64" cy="50" r="3.4" fill="#5b4a6e"/><circle cx="65.5" cy="48.5" r="1" fill="#fff"/>` +
    `<circle cx="74" cy="58" r="3.4" fill="#FFB7CE" opacity=".7"/>` +
    `<path d="M78 66 q-3 3 -7 2" stroke="#E6A6C6" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  "stk-un-shootingstar":
    `<defs><linearGradient id="sstrail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B79CFF" stop-opacity="0"/><stop offset="1" stop-color="#FFE66D"/></linearGradient></defs>` +
    `<path d="M16 78 q24 -10 44 -34" stroke="url(#sstrail)" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<path d="M22 72 q18 -8 32 -26" stroke="#FFB7E1" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M66 18 l5 14 15 1 -11.5 9.5 4 14.5 -12.5 -8 -12.5 8 4 -14.5 -11.5 -9.5 15 -1 Z" fill="#FFE66D" stroke="#E8B23A" stroke-width="1.6"/>`,
  "stk-un-cloud":
    `<defs><linearGradient id="uncl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6F0FF"/></linearGradient></defs>` +
    `<g fill="url(#uncl)" stroke="#CBDDF2" stroke-width="2"><circle cx="38" cy="52" r="16"/><circle cx="58" cy="46" r="20"/><circle cx="72" cy="56" r="14"/><rect x="34" y="56" width="44" height="16" rx="8" stroke="none"/></g>` +
    `<rect x="34" y="58" width="44" height="12" rx="6" fill="url(#uncl)"/>` +
    `<circle cx="48" cy="58" r="2.6" fill="#9BB8D9"/><circle cx="66" cy="58" r="2.6" fill="#9BB8D9"/><path d="M52 64 q4 4 8 0" stroke="#9BB8D9" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  "stk-un-heart":
    `<defs><linearGradient id="unh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB7D5"/><stop offset="1" stop-color="#FF6F9C"/></linearGradient></defs>` +
    `<path d="M50 80 C18 56 22 30 40 30 q10 0 10 12 q0 -12 10 -12 c18 0 22 26 -10 50 Z" fill="url(#unh)" stroke="#E84D7F" stroke-width="2"/>` +
    `<path d="M36 44 q4 -8 11 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M70 30 l1.6 5 5 1.6 -5 1.6 -1.6 5 -1.6 -5 -5 -1.6 5 -1.6 Z" fill="#FFF6B0"/>`,
  "stk-un-gem":
    `<path d="M50 16 L72 38 L50 86 L28 38 Z" fill="url(#foil)" stroke="#D9A93A" stroke-width="2"/>` +
    `<path d="M50 16 L62 38 L50 86 L38 38 Z" fill="#FFF0C2" opacity=".55"/>` +
    `<path d="M28 38 L72 38 M38 38 L50 16 M62 38 L50 16 M38 38 L50 86 M62 38 L50 86" stroke="#D9A93A" stroke-width="1.4" opacity=".8"/>` +
    `<path d="M40 28 l3 6 -6 1 Z" fill="#fff" opacity=".7"/>`,
  "stk-un-sparkle":
    // mascot: the unicorn, holo body + rainbow mane + a halo of sparkles
    `<defs><linearGradient id="spmane" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FA3"/><stop offset=".4" stop-color="#FFE66D"/><stop offset=".7" stop-color="#8FE39A"/><stop offset="1" stop-color="#6CC8FF"/></linearGradient></defs>` +
    // head + muzzle (holo)
    `<path d="M40 82 q-10 -14 -6 -30 q4 -18 22 -22 q16 -3 22 8 q5 8 1 16 l-6 26 q-2 8 -10 8 Z" fill="url(#holo)" stroke="#C6A4FF" stroke-width="2"/>` +
    // horn (gold foil)
    `<path d="M58 26 l6 -20 4 20 Z" fill="url(#foil)" stroke="#D9A93A" stroke-width="1.4"/>` +
    // ear
    `<path d="M44 30 l-4 -12 10 8 Z" fill="url(#holo)" stroke="#C6A4FF" stroke-width="1.4"/>` +
    // flowing rainbow mane
    `<path d="M48 22 q-18 6 -16 32 q6 -11 12 -11 q-8 11 -4 24 q6 -13 12 -13 q-4 13 2 21 q4 -15 12 -17 Z" fill="url(#spmane)"/>` +
    // eye + blush
    `<circle cx="64" cy="50" r="3.6" fill="#4a3a5e"/><circle cx="65.6" cy="48.4" r="1.1" fill="#fff"/>` +
    `<circle cx="74" cy="58" r="3.4" fill="#FFB7CE" opacity=".7"/>` +
    `<path d="M78 66 q-3 3 -7 2" stroke="#B98ACE" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    // sparkle halo
    `<path d="M82 24 l1.6 5 5 1.6 -5 1.6 -1.6 5 -1.6 -5 -5 -1.6 5 -1.6 Z" fill="#fff"/>` +
    `<path d="M24 40 l1.2 3.8 3.8 1.2 -3.8 1.2 -1.2 3.8 -1.2 -3.8 -3.8 -1.2 3.8 -1.2 Z" fill="#FFE66D"/>` +
    `<circle cx="30" cy="74" r="2" fill="#fff"/>`,
});

const PACK_TEXT = {
  "stk-sq-banner": { lines: ["⚔ SIDE", "QUEST"], bg: "#4A2F96", fg: "#E8DBFF" },
  "stk-un-magic": { lines: ["✨ STAY", "MAGIC ✨"], bg: "#B79CFF", fg: "#fff" },
};

const BACKGROUNDS = {
  "bg-tan-paint": { body: `<rect width="800" height="1100" fill="#C8B98F"/>${paintWear("#BBA87C")}` },
  "bg-navy-paint": { body: `<rect width="800" height="1100" fill="#2A3A55"/>${paintWear("#243149")}` },
  "bg-forest-paint": { body: `<rect width="800" height="1100" fill="#2F5243"/>${paintWear("#28473A")}` },
  "bg-grape-paint": { body: `<rect width="800" height="1100" fill="#4D3A66"/>${paintWear("#423158")}` },
  "bg-graph-paper": {
    body: `<rect width="800" height="1100" fill="#F3F1E7"/><path d="${grid(800, 1100, 40)}" stroke="#B8CFE0" stroke-width="1.4" opacity=".8"/>`,
  },
  "bg-denim": {
    body: `<rect width="800" height="1100" fill="#33507A"/><path d="${diag(800, 1100, 14)}" stroke="#2B4468" stroke-width="3"/><path d="${diag(800, 1100, 14, 7)}" stroke="#3C5C8A" stroke-width="1.6"/>`,
  },
  "bg-corkboard": { body: `<rect width="800" height="1100" fill="#C49A6C"/>${corkDots()}` },
  "bg-matte-black": { body: `<rect width="800" height="1100" fill="#1b1d22"/>${paintWear("#15171b")}` },
  "bg-chalkboard": {
    body: `<rect width="800" height="1100" fill="#2e4038"/>${paintWear("#28382f")}` +
      `<g stroke="#e8e6dc" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round">` +
      `<path d="M80 120 q40 -30 80 0"/><circle cx="640" cy="180" r="28"/><path d="M620 980 l60 0 m-30 -30 l0 60"/>` +
      `<path d="M120 900 q30 30 60 0 q30 -30 60 0"/><path d="M600 540 l50 -40 m0 40 l-50 -40"/></g>`,
  },
  "bg-galaxy": {
    body: `<rect width="800" height="1100" fill="#141327"/>` +
      `<ellipse cx="540" cy="320" rx="320" ry="180" fill="#2a2350" opacity=".55" transform="rotate(-24 540 320)"/>` +
      `<ellipse cx="240" cy="800" rx="280" ry="150" fill="#1d2c52" opacity=".5" transform="rotate(18 240 800)"/>` +
      galaxyStars(),
  },
  "bg-grid-horizon": {
    body: `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120f2e"/><stop offset=".62" stop-color="#3b1d5e"/><stop offset=".66" stop-color="#b8336a"/></linearGradient></defs>` +
      `<rect width="800" height="1100" fill="url(#sky)"/>` + galaxyStars(380) +
      `<circle cx="400" cy="700" r="120" fill="#ff7a59" opacity=".9"/>` +
      `<rect y="715" width="800" height="385" fill="#16102e"/>` +
      `<g stroke="#e051b6" stroke-width="2" opacity=".8">${gridHorizon()}</g>`,
  },
  "bg-poster-wall": {
    body: `<rect width="800" height="1100" fill="#3a3f4a"/>${paintWear("#333842")}` + posterWall(),
  },
  "bg-parchment-map": {
    body: `<rect width="800" height="1100" fill="#E8D9B0"/>${paintWear("#D8C493")}` +
      `<g stroke="#A88D52" stroke-width="3" fill="none" opacity=".75">` +
      `<path d="M120 180 q180 60 140 220 q-40 140 120 180 q200 40 160 240" stroke-dasharray="12 9"/>` +
      `<path d="M560 140 q120 80 60 200"/><circle cx="120" cy="180" r="10"/><circle cx="540" cy="920" r="12"/></g>` +
      `<path d="M520 905 l40 30 m0 -30 l-40 30" stroke="#9c3a22" stroke-width="7"/>` +
      `<g fill="#8A7A5C" opacity=".8"><path d="M200 620 l24 -38 24 38 Z"/><path d="M240 640 l20 -32 20 32 Z"/><path d="M168 648 l20 -30 20 30 Z"/></g>` +
      `<g fill="none" stroke="#6E8CA8" stroke-width="4" opacity=".7"><path d="M580 420 q16 -14 32 0 q16 14 32 0"/><path d="M600 460 q16 -14 32 0"/></g>` +
      `<circle cx="660" cy="180" r="52" fill="none" stroke="#A88D52" stroke-width="3"/><path d="M660 132 v96 M612 180 h96 M626 146 l68 68 M694 146 l-68 68" stroke="#A88D52" stroke-width="2" opacity=".7"/>` +
      `<text x="400" y="1050" font-family="Georgia" font-style="italic" font-size="30" text-anchor="middle" fill="#A88D52">here be lockers</text>`,
  },
  "bg-grip-tape": {
    body: `<rect width="800" height="1100" fill="#17181c"/>` + gripGrit() +
      `<g transform="rotate(-8 200 260)"><rect x="120" y="220" width="160" height="80" rx="12" fill="#E8485C"/><text x="200" y="268" font-family="Arial" font-weight="bold" font-size="26" text-anchor="middle" fill="#fff">RIDE ON</text></g>` +
      `<g transform="rotate(5 600 540)"><circle cx="600" cy="540" r="62" fill="#FFD23B"/><text x="600" y="550" font-family="Arial" font-weight="bold" font-size="24" text-anchor="middle" fill="#16181F">SKATE</text></g>` +
      `<g transform="rotate(-4 300 880)"><rect x="210" y="840" width="180" height="76" rx="10" fill="#3BA776"/><text x="300" y="886" font-family="Georgia" font-style="italic" font-weight="bold" font-size="28" text-anchor="middle" fill="#fff">GRIND</text></g>`,
  },
  "bg-night-woods": {
    body: `<defs><linearGradient id="nwsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1426"/><stop offset="1" stop-color="#13243a"/></linearGradient></defs>` +
      `<rect width="800" height="1100" fill="url(#nwsky)"/>` + galaxyStars(500) +
      `<circle cx="620" cy="170" r="64" fill="#E8E6DC" opacity=".92"/><circle cx="598" cy="152" r="14" fill="#C9C7BC" opacity=".6"/><circle cx="640" cy="190" r="10" fill="#C9C7BC" opacity=".5"/>` +
      pineRow(720, "#0e1c1a", 1.25) + pineRow(840, "#142a24", 1.0) + pineRow(960, "#1c3a30", 0.8) +
      `<ellipse cx="240" cy="600" rx="9" ry="13" fill="#FFE48A" opacity=".85"/><ellipse cx="540" cy="660" rx="7" ry="10" fill="#FFE48A" opacity=".7"/>` +
      `<rect width="800" height="1100" fill="url(#nwsky)" opacity="0"/>`,
  },
  "bg-chrome-sparkle": {
    body: `<defs><linearGradient id="chrm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE6F2"/><stop offset=".3" stop-color="#9AA8C0"/><stop offset=".5" stop-color="#F2F6FB"/><stop offset=".72" stop-color="#8694AE"/><stop offset="1" stop-color="#C4CEE0"/></linearGradient></defs>` +
      `<rect width="800" height="1100" fill="url(#chrm)"/>` +
      `<path d="M0 300 q400 -80 800 30 l0 60 q-400 -100 -800 -20 Z" fill="#B7E6F0" opacity=".5"/>` +
      `<path d="M0 540 q400 60 800 -40 l0 40 q-400 90 -800 30 Z" fill="#fff" opacity=".75"/>` +
      `<path d="M0 820 q400 -70 800 30 l0 50 q-400 -90 -800 -20 Z" fill="#F0BBDD" opacity=".45"/>` +
      `<path d="M0 1020 q400 50 800 -30 l0 110 l-800 0 Z" fill="#7E8CA4" opacity=".4"/>` +
      chromeGlints(),
  },
  "bg-pastel-sky": {
    body: `<defs><linearGradient id="psky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE3F1"/><stop offset=".4" stop-color="#E9D8FF"/><stop offset=".75" stop-color="#D6ECFF"/><stop offset="1" stop-color="#FCEFD8"/></linearGradient></defs>` +
      `<rect width="800" height="1100" fill="url(#psky)"/>` +
      // big soft rainbow arc top-right
      ["#FF8FA3", "#FFB86C", "#FFE66D", "#8FE39A", "#6CC8FF", "#B79CFF"]
        .map((c, i) => `<path d="M${520 + i * 26} 1100 a${300 - i * 26} ${300 - i * 26} 0 0 1 ${(300 - i * 26) * 2} 0" fill="none" stroke="${c}" stroke-width="26" opacity=".7"/>`)
        .join("") +
      // fluffy clouds
      [[140, 300, 1], [620, 220, 0.8], [300, 720, 0.9], [560, 880, 0.7]]
        .map(([x, y, s]) => `<g opacity=".92"><ellipse cx="${x}" cy="${y}" rx="${70 * s}" ry="${42 * s}" fill="#fff"/><ellipse cx="${x + 50 * s}" cy="${y + 8 * s}" rx="${50 * s}" ry="${34 * s}" fill="#fff"/><ellipse cx="${x - 46 * s}" cy="${y + 10 * s}" rx="${42 * s}" ry="${30 * s}" fill="#fff"/></g>`)
        .join("") +
      // sparkle stars
      pastelStars(),
  },
  "bg-banner-wall": {
    body: `<rect width="800" height="1100" fill="#2B3340"/>${paintWear("#252c38")}` +
      [
        { x: 130, y: 120, c: "#6E2424", t: "WINS", rot: -2 },
        { x: 420, y: 100, c: "#2F5243", t: "GO TEAM", rot: 1.5 },
        { x: 240, y: 430, c: "#33507A", t: "VARSITY", rot: -1 },
        { x: 520, y: 460, c: "#7A5818", t: "CHAMPS", rot: 2 },
        { x: 150, y: 760, c: "#4D3A66", t: "HOME", rot: 1 },
        { x: 460, y: 790, c: "#6E2424", t: "PRIDE", rot: -2 },
      ]
        .map(
          (b) =>
            `<g transform="rotate(${b.rot} ${b.x + 110} ${b.y + 130})">` +
            `<path d="M${b.x} ${b.y} h220 v200 l-110 60 l-110 -60 Z" fill="${b.c}" stroke="#0006" stroke-width="3"/>` +
            `<path d="M${b.x + 14} ${b.y + 14} h192 v178 l-96 52 l-96 -52 Z" fill="none" stroke="#F4E8C8" stroke-width="3" opacity=".6"/>` +
            `<text x="${b.x + 110}" y="${b.y + 120}" font-family="Georgia" font-weight="bold" font-size="34" text-anchor="middle" fill="#F4E8C8">${b.t}</text>` +
            `<circle cx="${b.x + 18}" cy="${b.y + 12}" r="6" fill="#cfd4dc"/><circle cx="${b.x + 202}" cy="${b.y + 12}" r="6" fill="#cfd4dc"/></g>`
        )
        .join(""),
  },
};

function pastelStars() {
  let out = "";
  let seed = 555;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tints = ["#fff", "#FFE66D", "#FFB7E1", "#B79CFF"];
  for (let i = 0; i < 34; i++) {
    const x = (rnd() * 760 + 20) | 0;
    const y = (rnd() * 1060 + 20) | 0;
    const s = rnd() * 12 + 5;
    const c = tints[(rnd() * tints.length) | 0];
    out += `<path d="M${x} ${y - s} L${x + s * 0.24} ${y - s * 0.24} L${x + s} ${y} L${x + s * 0.24} ${y + s * 0.24} L${x} ${y + s} L${x - s * 0.24} ${y + s * 0.24} L${x - s} ${y} L${x - s * 0.24} ${y - s * 0.24} Z" fill="${c}" opacity="${(rnd() * 0.4 + 0.55).toFixed(2)}"/>`;
  }
  return out;
}
function gripGrit() {
  let out = "";
  let seed = 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1500; i++) {
    const shade = rnd() > 0.5 ? "#23252c" : "#0d0e12";
    out += `<rect x="${(rnd() * 798) | 0}" y="${(rnd() * 1098) | 0}" width="${(rnd() * 2.4 + 0.8).toFixed(1)}" height="${(rnd() * 2.4 + 0.8).toFixed(1)}" fill="${shade}" opacity="${(rnd() * 0.6 + 0.3).toFixed(2)}"/>`;
  }
  return out;
}
function pineRow(yBase, color, scale) {
  let out = "";
  let seed = yBase;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = -40; x < 840; x += 70 * scale) {
    const h = (140 + rnd() * 80) * scale;
    const w = (54 + rnd() * 22) * scale;
    out += `<path d="M${x} ${yBase} L${x + w / 2} ${yBase - h} L${x + w} ${yBase} Z" fill="${color}"/>`;
    out += `<path d="M${x + w * 0.12} ${yBase - h * 0.32} L${x + w / 2} ${yBase - h} L${x + w * 0.88} ${yBase - h * 0.32} Z" fill="${color}"/>`;
  }
  out += `<rect x="0" y="${yBase}" width="800" height="${1100 - yBase}" fill="${color}"/>`;
  return out;
}
function chromeGlints() {
  let out = "";
  let seed = 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = (rnd() * 760 + 20) | 0;
    const y = (rnd() * 1060 + 20) | 0;
    const s = rnd() * 26 + 10;
    const tint = rnd();
    const fill = tint > 0.8 ? "#B7E6F0" : tint > 0.6 ? "#F0BBDD" : "#fff";
    out += `<path d="M${x} ${y - s} L${x + s * 0.2} ${y - s * 0.2} L${x + s} ${y} L${x + s * 0.2} ${y + s * 0.2} L${x} ${y + s} L${x - s * 0.2} ${y + s * 0.2} L${x - s} ${y} L${x - s * 0.2} ${y - s * 0.2} Z" fill="${fill}" opacity="${(rnd() * 0.45 + 0.5).toFixed(2)}"/>`;
    if (s > 24) out += `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff"/>`;
  }
  return out;
}

function galaxyStars(maxY = 1100) {
  let out = "";
  let seed = 99;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 130; i++) {
    out += `<circle cx="${(rnd() * 800) | 0}" cy="${(rnd() * maxY) | 0}" r="${(rnd() * 1.6 + 0.5).toFixed(1)}" fill="#fff" opacity="${(rnd() * 0.7 + 0.25).toFixed(2)}"/>`;
  }
  return out;
}
function gridHorizon() {
  let d = "";
  for (let i = 0; i <= 12; i++) {
    const x = 400 + (i - 6) * 24;
    const xEnd = 400 + (i - 6) * 220;
    d += `<line x1="${x}" y1="715" x2="${xEnd}" y2="1100"/>`;
  }
  for (let i = 1; i <= 7; i++) {
    const y = 715 + i * i * 8;
    d += `<line x1="0" y1="${y}" x2="800" y2="${y}"/>`;
  }
  return d;
}
function posterWall() {
  // Original gig posters only — invented bands, original layouts.
  const posters = [
    { x: 60, y: 90, w: 220, h: 300, bg: "#E8485C", t1: "THE", t2: "BELL CURVES", rot: -3 },
    { x: 330, y: 140, w: 200, h: 270, bg: "#16324F", t1: "midnight", t2: "homeroom", rot: 2 },
    { x: 570, y: 80, w: 180, h: 250, bg: "#E8B23A", t1: "LATE BUS", t2: "WORLD TOUR", rot: -2 },
    { x: 100, y: 470, w: 200, h: 280, bg: "#2F5243", t1: "study", t2: "hall stars", rot: 2.5 },
    { x: 360, y: 500, w: 230, h: 300, bg: "#4D3A66", t1: "GLORP", t2: "LIVE", rot: -1.5 },
    { x: 560, y: 430, w: 190, h: 260, bg: "#23262E", t1: "NO", t2: "SKIPS", rot: 3 },
    { x: 200, y: 820, w: 220, h: 240, bg: "#7A2E2E", t1: "DEMI &", t2: "THE NOTES", rot: -2 },
    { x: 480, y: 800, w: 210, h: 260, bg: "#33507A", t1: "vibes", t2: "fest", rot: 1.5 },
  ];
  return posters
    .map(
      (p) =>
        `<g transform="rotate(${p.rot} ${p.x + p.w / 2} ${p.y + p.h / 2})">` +
        `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.bg}" stroke="#0006" stroke-width="2"/>` +
        `<text x="${p.x + p.w / 2}" y="${p.y + p.h * 0.42}" font-family="Arial" font-weight="bold" font-size="${p.w / 7}" text-anchor="middle" fill="#fff" opacity=".92">${p.t1}</text>` +
        `<text x="${p.x + p.w / 2}" y="${p.y + p.h * 0.6}" font-family="Arial" font-weight="bold" font-size="${p.w / 8}" text-anchor="middle" fill="#fff" opacity=".8">${p.t2}</text>` +
        `<circle cx="${p.x + p.w / 2}" cy="${p.y + 8}" r="5" fill="#cfd4dc"/>` +
        `</g>`
    )
    .join("");
}

function paintWear(c) {
  let out = "";
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    out += `<circle cx="${(rnd() * 800) | 0}" cy="${(rnd() * 1100) | 0}" r="${(rnd() * 60 + 14) | 0}" fill="${c}" opacity="${(rnd() * 0.25 + 0.08).toFixed(2)}"/>`;
  }
  return out;
}
function grid(w, h, step) {
  let d = "";
  for (let x = 0; x <= w; x += step) d += `M${x} 0 V${h} `;
  for (let y = 0; y <= h; y += step) d += `M0 ${y} H${w} `;
  return d;
}
function diag(w, h, step, off = 0) {
  let d = "";
  for (let x = -h + off; x <= w; x += step) d += `M${x} 0 L${x + h} ${h} `;
  return d;
}
function corkDots() {
  let out = "";
  let seed = 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const shade = rnd() > 0.5 ? "#B68A5C" : "#D2AC7E";
    out += `<circle cx="${(rnd() * 800) | 0}" cy="${(rnd() * 1100) | 0}" r="${(rnd() * 3 + 1).toFixed(1)}" fill="${shade}" opacity=".55"/>`;
  }
  return out;
}

function svg(size, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}">${body}</svg>\n`;
}

function write(rel, content) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  console.log("wrote", rel);
}

for (const item of catalog.items) {
  const rel = item.asset.replace(/^\//, "");
  if (item.type === "background") {
    const bg = BACKGROUNDS[item.id];
    write(rel, svg({ w: 800, h: 1100 }, bg.body));
  } else if (item.type === "sticker") {
    const textSpec = ARCADE_TEXT[item.id] ?? MIX_TEXT[item.id] ?? PACK_TEXT[item.id];
    if (textSpec) {
      // Rectangular die-cut text sticker (arcade marquee / tape-label style).
      write(
        rel,
        svg(
          { w: 120, h: 70 },
          `<rect x="2.5" y="2.5" width="115" height="65" rx="13" fill="#fff"/><rect x="2.5" y="2.5" width="115" height="65" rx="13" fill="none" stroke="#00000018" stroke-width="1.5"/><rect x="9" y="9" width="102" height="52" rx="8" fill="${textSpec.bg}"/>` +
            textSpec.lines
              .map(
                (l, i) =>
                  `<text x="60" y="${textSpec.lines.length === 1 ? 43 : 31 + i * 21}" font-family="'Courier New', ui-monospace, monospace" font-weight="bold" font-size="15" text-anchor="middle" fill="${textSpec.fg}" letter-spacing="1.5">${l}</text>`
              )
              .join("")
        )
      );
    } else {
      const glyph =
        GLYPHS[item.id] ?? PX[item.id] ?? MIXTAPE[item.id] ?? PACKS[item.id] ?? `<circle cx="50" cy="50" r="30" fill="#888"/>`;
      // Die-cut: white border halo + faint inner stroke so the border reads
      // on light paints too.
      write(
        rel,
        svg(
          { w: 100, h: 100 },
          `<defs>${FOIL}${HOLO}</defs><circle cx="50" cy="50" r="44" fill="#fff"/><circle cx="50" cy="50" r="44" fill="none" stroke="#00000018" stroke-width="2"/>${glyph}`
        )
      );
    }
  } else if (item.type === "button") {
    const b = BUTTON_TEXT[item.id] ?? { bg: "#555", fg: "#fff", lines: [item.name.toUpperCase()] };
    const text = b.lines
      .map(
        (l, i) =>
          `<text x="50" y="${b.lines.length === 1 ? 55 : 46 + i * 16}" font-family="Arial" font-weight="bold" font-size="11.5" text-anchor="middle" fill="${b.fg}" letter-spacing="1">${l}</text>`
      )
      .join("");
    write(
      rel,
      svg(
        { w: 100, h: 100 },
        `<defs><radialGradient id="rim" cx=".35" cy=".3" r="1"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#cfd4dc"/><stop offset="1" stop-color="#8c93a1"/></radialGradient></defs><circle cx="50" cy="50" r="47" fill="url(#rim)"/><circle cx="50" cy="50" r="41" fill="${b.bg}"/><ellipse cx="38" cy="32" rx="16" ry="9" fill="#fff" opacity=".28"/>${text}`
      )
    );
  } else if (item.type === "patch") {
    write(
      rel,
      svg(
        { w: 120, h: 90 },
        `<rect x="6" y="6" width="108" height="78" rx="16" fill="${item.id === "pat-varsity-d" ? "#7A2E2E" : "#34514B"}"/><rect x="11" y="11" width="98" height="68" rx="12" fill="none" stroke="#E8E2D0" stroke-width="3" stroke-dasharray="6 4"/>` +
          (item.id === "pat-varsity-d"
            ? `<text x="60" y="60" font-family="Georgia" font-size="40" font-weight="bold" text-anchor="middle" fill="#E8E2D0">D</text>`
            : `<circle cx="60" cy="45" r="17" fill="none" stroke="#E8E2D0" stroke-width="4"/><path d="M60 28 V62 M43 45 H77" stroke="#E8E2D0" stroke-width="4"/>`)
      )
    );
  } else if (item.type === "magnet") {
    const c = item.id.endsWith("2") ? "#C0392B" : "#23262E";
    write(
      rel,
      svg(
        { w: 80, h: 80 },
        `<rect x="12" y="12" width="56" height="56" rx="12" fill="${c}"/><rect x="18" y="18" width="44" height="20" rx="9" fill="#fff" opacity=".14"/>`
      )
    );
  } else if (item.type === "mirror") {
    write(
      rel,
      svg(
        { w: 100, h: 150 },
        `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8EDF2"/><stop offset=".45" stop-color="#B9C2CE"/><stop offset=".55" stop-color="#D7DEE6"/><stop offset="1" stop-color="#9AA4B2"/></linearGradient></defs><rect x="4" y="4" width="92" height="142" rx="10" fill="#6E7682"/><rect x="10" y="10" width="80" height="130" rx="7" fill="url(#m)"/><path d="M20 36 L48 14 M28 52 L70 18" stroke="#fff" stroke-width="2.5" opacity=".7"/>`
      )
    );
  }
}
// Card thumbnails (shoebox/store only — on the door these render LIVE).
write(
  "locker/cards/crd-today.svg",
  svg(
    { w: 100, h: 100 },
    `<rect x="14" y="18" width="72" height="64" rx="5" fill="#FDFBF4" stroke="#D8D2BF" stroke-width="2"/><rect x="14" y="18" width="72" height="14" rx="5" fill="#E8485C"/><text x="50" y="28.5" font-family="Arial" font-weight="bold" font-size="9" text-anchor="middle" fill="#fff" letter-spacing="1">TODAY</text>` +
      [42, 52, 62, 72].map((y) => `<line x1="22" y1="${y}" x2="78" y2="${y}" stroke="#C9D6E4" stroke-width="2"/>`).join("")
  )
);
write(
  "locker/cards/crd-month.svg",
  svg(
    { w: 100, h: 100 },
    `<rect x="14" y="16" width="72" height="68" rx="6" fill="#FDFBF4" stroke="#D8D2BF" stroke-width="2"/><rect x="14" y="16" width="72" height="16" rx="6" fill="#3A7CC2"/><rect x="14" y="26" width="72" height="6" fill="#3A7CC2"/>` +
      `<rect x="26" y="11" width="5" height="10" rx="2.5" fill="#8a917e"/><rect x="69" y="11" width="5" height="10" rx="2.5" fill="#8a917e"/>` +
      [0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((col) => {
          const x = 22 + col * 15, y = 40 + r * 14;
          const done = (r * 4 + col) % 3 === 0;
          return done
            ? `<rect x="${x}" y="${y}" width="11" height="10" rx="3" fill="#3BD27A"/><path d="M${x + 2.5} ${y + 5} l2.2 2.4 4-4.8" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
            : `<rect x="${x}" y="${y}" width="11" height="10" rx="3" fill="none" stroke="#C9C2AC" stroke-width="1.5"/>`;
        }).join("")
      ).join("")
  )
);
write(
  "locker/cards/crd-work.svg",
  svg(
    { w: 100, h: 100 },
    // gold-star paper: a proud page pinned up, star seal top-right
    `<rect x="16" y="14" width="64" height="74" rx="4" fill="#FDFBF4" stroke="#D8D2BF" stroke-width="2" transform="rotate(-3 50 50)"/>` +
      [30, 40, 50, 60].map((y) => `<line x1="26" y1="${y}" x2="70" y2="${y}" stroke="#C9D6E4" stroke-width="2.5" transform="rotate(-3 50 50)"/>`).join("") +
      `<path d="M74 12 l3.2 6.5 7.2 1 -5.2 5 1.2 7.1 -6.4 -3.4 -6.4 3.4 1.2 -7.1 -5.2 -5 7.2 -1z" fill="#F0B647" stroke="#D89B2A" stroke-width="1.5"/>`
  )
);
write(
  "locker/cards/crd-goal.svg",
  svg(
    { w: 100, h: 100 },
    `<rect x="12" y="26" width="76" height="48" rx="7" fill="#16324F"/><circle cx="12" cy="50" r="5" fill="#0f1118"/><circle cx="88" cy="50" r="5" fill="#0f1118"/><text x="50" y="44" font-family="Arial" font-weight="bold" font-size="10" text-anchor="middle" fill="#9BE7FF" letter-spacing="1">MY GOAL</text><rect x="22" y="52" width="56" height="9" rx="4.5" fill="#0c2238"/><rect x="22" y="52" width="38" height="9" rx="4.5" fill="#3BD27A"/>`
  )
);

// Shared noise tile — applied as a repeated background-image (the filter
// rasterizes once when the image loads; never a live CSS filter).
write(
  "locker/textures/noise.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0"/></filter><rect width="140" height="140" filter="url(#n)"/></svg>\n`
);
console.log("done");
