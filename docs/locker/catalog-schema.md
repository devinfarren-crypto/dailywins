# The Locker — Catalog Schema & Process

*Drafted 2026-06-11. The catalog is a JSON file in the repo (decision made):
versioned with git, validated by Zod at build time, no CMS.*

## Item fields

| field | type | rules |
|---|---|---|
| id | string | `^(stk|btn|pat|mag|mir|bg)-[a-z0-9-]+$` — type prefix + kebab slug. **Never reused, never renamed** (inventory + ledger reference it forever). |
| name | string | ≤ 28 chars, display name in store + tray |
| type | enum | sticker · button · patch · magnet · mirror · background |
| price | int ≥ 0 | 0 only when `starter: true`. Bands in points-economy.md. |
| starter | boolean | true → granted to every student at first launch |
| weight | enum | quiet · medium · loud — *visual weight*, not gameplay rarity: drives store sorting and tasteful-default suggestions, never odds (no odds exist) |
| tags | string[] | search/filter facets (music, retro, school, holo, …) |
| asset | string | `/locker/{type-plural}/{id}.webp` — placeholder path until art exists |

Top level: `catalog_version` (int, bump on ANY change) + `updated` date.

## Zod (mirrors the table above; lives in `src/lib/locker/catalog-schema.ts` when built)

```ts
const CatalogItem = z.object({
  id: z.string().regex(/^(stk|btn|pat|mag|mir|bg)-[a-z0-9-]+$/),
  name: z.string().min(1).max(28),
  type: z.enum(["sticker","button","patch","magnet","mirror","background"]),
  price: z.number().int().min(0),
  starter: z.boolean(),
  weight: z.enum(["quiet","medium","loud"]),
  tags: z.array(z.string()).max(6),
  asset: z.string().startsWith("/locker/"),
}).refine(i => i.price === 0 ? i.starter : true, "free items must be starter");

const Catalog = z.object({
  catalog_version: z.number().int().positive(),
  updated: z.string(),
  items: z.array(CatalogItem).superRefine(uniqueIds),
});
```

A unit test parses `catalog-v1.json` with this schema — a malformed catalog
fails CI, not a classroom.

## Rules of change

1. **Add** items freely: new id, bump `catalog_version`, commit.
2. **Reprice**: allowed; history is safe because every purchase ledger row
   stored `{item_id, price_paid, catalog_version}`. Never retro-charge.
3. **Retire**: add `"retired": true` (hides from store). Owned copies keep
   working forever — a retired sticker on a door stays on the door.
4. **Never delete or rename an id.** Grep `student_inventory` first if
   tempted.
5. Starter-set changes apply to NEW students only; no clawbacks.

## Asset pipeline (v1)

Static files under `public/locker/` (decision leaning static — see
build-plan.md verification #2): WebP, ≤ 100 KB each, 2× max display size,
transparent backgrounds for placeables, tileable or door-sized (~800×1100)
for backgrounds. Commissioned/AI-generated art reviewed by Devin before
commit; no licensed characters, no brand logos (the vibe is generic-nostalgic,
not trademark roulette).
