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
  "stk-px-joystick": pixels(
    ["..RR..", ".RRRR.", ".RRRR.", "..GG..", "..GG..", "DDDDDD", "DDDDDD"],
    { R: "#E8485C", G: "#5A6378", D: "#23262E" }, 8, 26, 20
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
  "stk-mx-headphones": `<path d="M28 58 a22 22 0 0 1 44 0" stroke="#2A2D36" stroke-width="8" fill="none"/><rect x="22" y="54" width="13" height="22" rx="6" fill="#E8485C"/><rect x="65" y="54" width="13" height="22" rx="6" fill="#E8485C"/>`,
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
};

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
    const textSpec = ARCADE_TEXT[item.id] ?? MIX_TEXT[item.id];
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
        GLYPHS[item.id] ?? PX[item.id] ?? MIXTAPE[item.id] ?? `<circle cx="50" cy="50" r="30" fill="#888"/>`;
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
// Shared noise tile — applied as a repeated background-image (the filter
// rasterizes once when the image loads; never a live CSS filter).
write(
  "locker/textures/noise.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0"/></filter><rect width="140" height="140" filter="url(#n)"/></svg>\n`
);
console.log("done");
