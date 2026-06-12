import { z } from "zod";
import rawCatalog from "./catalog-v1.json";

// The Locker's shared shapes — Zod mirrors the Postgres constraints in
// migration 053 (see docs/locker/data-model.md for the mapping table).

export const CatalogItemSchema = z
  .object({
    id: z.string().regex(/^(stk|btn|pat|mag|mir|bg|crd)-[a-z0-9-]+$/),
    name: z.string().min(1).max(28),
    type: z.enum(["sticker", "button", "patch", "magnet", "mirror", "background", "card"]),
    pack: z.string().min(1), // collection slug ("classics", "arcade", "mixtape", …)
    // Rarity drives visual treatment + price ONLY — never drops, never timers.
    rarity: z.enum(["common", "foil", "holo"]),
    price: z.number().int().min(0),
    starter: z.boolean(),
    tags: z.array(z.string()).max(6),
    asset: z.string().startsWith("/locker/"),
    retired: z.boolean().optional(),
  })
  .refine((i) => (i.price === 0 ? i.starter : true), "free items must be starter");

export const CatalogSchema = z.object({
  catalog_version: z.number().int().positive(),
  updated: z.string(),
  items: z.array(CatalogItemSchema).superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (const i of items) {
      if (seen.has(i.id)) ctx.addIssue({ code: "custom", message: `duplicate id ${i.id}` });
      seen.add(i.id);
    }
  }),
});

export type CatalogItem = z.infer<typeof CatalogItemSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;

// Validated at module load — a malformed catalog fails the build, not a class.
export const CATALOG: Catalog = CatalogSchema.parse(rawCatalog);
export const CATALOG_BY_ID = new Map(CATALOG.items.map((i) => [i.id, i]));
export const STARTER_ITEMS = CATALOG.items.filter((i) => i.starter);

// ── Layout (locker_layouts.layout JSONB) ────────────────────────────────────
export const PlacedItemSchema = z.object({
  item_id: z.string(),
  x: z.number().min(-0.15).max(1.15), // items may hang off edges, like real stickers
  y: z.number().min(-0.15).max(1.15),
  z: z.number().int().min(0).max(99),
  rot: z.number().min(-45).max(45),
  scale: z.number().min(0.5).max(2).optional(), // 1 = catalog size
  // Proud-work data rides ON the placed card so students can show off as
  // many assignments as they like — each placed crd-work holds its own link.
  // Host allowlist re-checked server-side per item on every save.
  work: z
    .object({
      url: z.string().url().max(500),
      caption: z.number().int().min(0).max(11),
    })
    .optional(),
});

export const LayoutSchema = z.object({
  background: z.string().nullable(),
  items: z.array(PlacedItemSchema).max(40), // mirrors the 054 DB CHECK
  // The goal card's chosen behavior category + target % — student-writable
  // state, but only a category id and a bounded number, never free text.
  goal: z
    .object({
      category: z.string(),
      target: z.number().int().min(50).max(100).optional(), // default 80 in UI
    })
    .nullable()
    .optional(),
  // LEGACY single proud-work slot — superseded by PlacedItem.work (one link
  // per placed card). Still parsed so old saved layouts load; the client
  // migrates it onto the first work card and clears it on the next save.
  work: z
    .object({
      url: z.string().url().max(500),
      caption: z.number().int().min(0).max(11),
    })
    .nullable()
    .optional(),
  // Month card marks: the student checks off finished school days and colors
  // no-school days. Date keys + a two-value enum — bounded, never free text.
  // The client prunes marks older than last month; the cap is the backstop.
  calendar: z
    .object({
      marks: z
        .record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.enum(["done", "off"]))
        .refine((m) => Object.keys(m).length <= 80, "too many marks"),
    })
    .nullable()
    .optional(),
});

export const GOAL_TARGETS = [60, 70, 80, 90, 100];

// Preset captions for the proud-work card — the only "text" a student can
// attach, chosen from this list by index (privacy: no free text surfaces).
export const WORK_CAPTIONS = [
  "My best work",
  "Proud of this one",
  "Took me forever",
  "Personal record",
  "Check this out",
  "My favorite",
];

// Hosts a proud-work link may point to. Google's own sharing permissions
// decide who can actually open it — we only hold the pointer.
export const WORK_URL_HOSTS = ["docs.google.com", "drive.google.com"];

export function isAllowedWorkUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && WORK_URL_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export const PACK_NAMES: Record<string, string> = {
  classics: "Classics",
  arcade: "Arcade",
  mixtape: "Mixtape",
  sidequest: "Side Quest",
  kickflip: "Kickflip",
  cryptid: "Cryptid Club",
  y2k: "Y2K",
  varsity: "Varsity",
};

export type PlacedItem = z.infer<typeof PlacedItemSchema>;
export type LockerLayout = z.infer<typeof LayoutSchema>;

export const WELCOME_GRANT = 100; // decision #4: no backfill, one warm hello
