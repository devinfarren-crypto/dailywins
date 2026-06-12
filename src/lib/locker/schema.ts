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
});

export const LayoutSchema = z.object({
  background: z.string().nullable(),
  items: z.array(PlacedItemSchema).max(40), // mirrors the 054 DB CHECK
  // The goal card's chosen behavior category — student-writable state, but
  // only a category id, never free text.
  goal: z.object({ category: z.string() }).nullable().optional(),
});

export const PACK_NAMES: Record<string, string> = {
  classics: "Classics",
  arcade: "Arcade",
  mixtape: "Mixtape",
};

export type PlacedItem = z.infer<typeof PlacedItemSchema>;
export type LockerLayout = z.infer<typeof LayoutSchema>;

export const WELCOME_GRANT = 100; // decision #4: no backfill, one warm hello
