# DailyWins

Classroom behavior tracking app for school districts. Migrating from a Google Apps Script prototype.

**Production URL:** dailywins.school
**Owner:** Sure Step Education

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS v4 (mixed with inline `style={}` in legacy dashboard code)
- **Backend/DB:** Supabase (Postgres, Auth, Realtime) via `@supabase/ssr` + `@supabase/supabase-js`
- **Auth:** Supabase Auth — Google SSO + passwordless email magic-link ([app/page.tsx](app/page.tsx)). Both routes flow through the same `/auth/callback` gate; access is granted by founder approval of an access request (`access_requests` + `/admin/requests`), not the legacy email allowlist.
- **Charts:** Recharts (browser-only — see Gotchas)
- **PDF export:** jspdf + jspdf-autotable (browser-only — see Gotchas)
- **Validation:** zod
- **AI:** `@anthropic-ai/sdk` (used server-side for schedule parsing)
- **Deployment:** Vercel
- **PWA:** manifest + service worker installed via [src/components/PWAProvider.jsx](src/components/PWAProvider.jsx)
- **Package manager:** npm

## Project Structure

```
app/
  api/
    auth/check-allowed       → email allowlist gate
    demo/{seed,wipe}         → demo-mode data lifecycle
    refresh-google-token     → Google OAuth token refresh
    schedule/{parse,save}    → bell-schedule PDF parsing + persistence
  auth/callback              → Supabase OAuth callback
  dashboard/
    page.tsx                 → wraps DashboardClient in `dynamic(..., { ssr: false })` + error boundary
    DashboardClient.tsx      → main teacher UI (heavy, client-only)
    ChartViews.tsx           → Recharts views
    sheetsSync.ts            → legacy Google Sheets sync helpers
  access-denied/, privacy/, test-uploader/
  layout.tsx, page.tsx, globals.css
src/
  components/   → PWAProvider, ScheduleUploader
  lib/          → supabase{,-server,-admin}.ts, schedules-*, demo-seed, use-schedules
supabase/migrations/  → numbered SQL (001–010); allowlist in 009, school_schedules in 010
docs/bell-schedules/  → reference PDFs for PGHS and COHS bell schedules
public/        → icons/, manifest.json, sw.js, static assets
```

Path alias: `@/*` → project root (see [tsconfig.json](tsconfig.json)).

## Commands

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Run ESLint
```

## Domain Model

Teachers track 5 behavior categories per student per period:

| Category   | Description                        |
|------------|------------------------------------|
| Arrival    | Student arrived on time/prepared   |
| Compliance | Following directions/rules         |
| Social     | Positive peer interactions         |
| On-Task    | Engaged with classwork             |
| Phone Away | Phone stored and not in use        |

- Up to 9 periods per day (0–8) — schools with a zero-period prep block use Period 0; most schools use 1–8
- Each behavior is a binary win (yes/no) per period
- Teachers log in via Google SSO or a passwordless email magic-link; new accounts land in `/pending` until a founder approves their access request in `/admin/requests`

## Brand

- **Primary / coral:** `#e07850` (CTAs, logo mark, primary accents)
- **Secondary / teal:** `#3a7c6a` (links, secondary accents; darker `#2a4d42` for headings)
- **Accent / gold:** `#f0b647` (highlights, chart accent)
- **Dark / ink:** `#2c3e50`
- **Background creams:** `#faf7f0` (marketing), `#f5f5f0` (app surfaces)
- **Font:** Nunito as the default app font, loaded via Google Fonts in [app/dashboard/DashboardClient.tsx](app/dashboard/DashboardClient.tsx) (users can switch among Nunito / Inter / Baloo 2 / Fredoka / Patrick Hand / Quicksand). The Geist setup in [app/layout.tsx](app/layout.tsx) is leftover from `create-next-app`.
- Chart palette is defined in [app/dashboard/ChartViews.tsx](app/dashboard/ChartViews.tsx) — reuse it instead of introducing new colors.
- Vocabulary note: in code, `#3a7c6a` is commented as "secondary/green" and a separate `#1abc9c` is labeled "teal" in the ChartViews palette — the brand name for `#3a7c6a` is still "teal", don't confuse the two.

## Key Conventions

- Server Components by default; add `"use client"` only when needed.
- Supabase client picker:
  - Client Components → `createClient` from [src/lib/supabase.ts](src/lib/supabase.ts) (browser, anon key)
  - Server Components / Route Handlers → `createClient` from [src/lib/supabase-server.ts](src/lib/supabase-server.ts) (cookies-aware, anon key)
  - Privileged server work → `createAdminClient` from [src/lib/supabase-admin.ts](src/lib/supabase-admin.ts) (service role, bypasses RLS — server-side only, never imported into client code)
- All database access goes through Supabase (no direct Postgres connections).
- TypeScript strict — no `any`.
- Schema changes go through a new numbered file in `supabase/migrations/`; do not edit prior migrations in place.

## Critical Gotchas

- **Recharts is browser-only.** Any page that imports it must opt out of SSR via `dynamic(() => import("..."), { ssr: false })`. See [app/dashboard/page.tsx](app/dashboard/page.tsx) — it wraps [DashboardClient](app/dashboard/DashboardClient.tsx) precisely for this reason. Importing Recharts directly into a Server Component (or a client component that gets server-rendered) crashes the module silently at build/runtime.
- **jspdf and jspdf-autotable are browser-only.** Always lazy-import inside the event handler that needs them, e.g. `const { default: jsPDF } = await import("jspdf")` — never at the top of a module. Examples in [app/dashboard/DashboardClient.tsx:1466](app/dashboard/DashboardClient.tsx#L1466) and [:1545](app/dashboard/DashboardClient.tsx#L1545).
- **`createAdminClient` uses the service role key and bypasses RLS.** Use it only in Route Handlers / server actions, never in a file that could be bundled into the client.
- **Access is approval-gated, not allowlist-gated.** Anyone can authenticate (Google or magic-link), but unprovisioned users land in `/pending` until a founder approves their `access_requests` row in `/admin/requests`. The old `allowed_emails` table (migration 009) + `api/auth/check-allowed` are vestigial — the active `/auth/callback` route no longer reads them.
- **Bell schedules live in `public.schools.schedules` (JSONB) — that's the source of truth.** `BELL_SCHEDULES` in `DashboardClient.tsx` is intentionally empty (`{}`) as of 2026-05-30; it's the fallback for first-paint + DB-failure recovery, kept empty so a DB hiccup shows nothing rather than misleading stale data. The source PDFs at `docs/bell-schedules/` are the authoritative inputs the AI uploader parses (`app/api/schedule/parse/route.ts`). Adding a third school is a DB row plus an uploader run, not a code edit.
- **Pilot is approval-scoped** to a handful of teachers (Devin/Tommy at PGHS, Nick at COHS, plus a throwaway test account) — bear that in mind before assuming multi-tenant features are wired up.
