# DailyWins — Front End / Back End Map

How this codebase divides into front end and back end, and how to work on each side without stepping on the other.

**Important:** Next.js App Router intentionally keeps both sides in one tree — pages and their API routes deploy together on Vercel. We do **not** physically split the repo into `frontend/` and `backend/` folders (that would break routing and the build). The split is logical (this map) and workflow-level (the `frontend` / `backend` branches below).

## Front end — what the user sees and taps

Client-rendered UI, styling, charts, PDFs, PWA.

| Area | Files |
|---|---|
| Landing page (sign-in) | [app/page.tsx](app/page.tsx) |
| Teacher dashboard (the core UI) | [app/dashboard/DashboardClient.tsx](app/dashboard/DashboardClient.tsx) (grid, Customize, PDF export), [app/dashboard/ChartViews.tsx](app/dashboard/ChartViews.tsx) (Recharts), [app/dashboard/page.tsx](app/dashboard/page.tsx) (SSR-off wrapper) |
| Magic-link views (parent / student / co-teacher) | [app/parent/[token]/page.tsx](app/parent/%5Btoken%5D/page.tsx), [app/student/[token]/page.tsx](app/student/%5Btoken%5D/page.tsx), [app/coteacher/[token]/page.tsx](app/coteacher/%5Btoken%5D/page.tsx), [src/components/MagicLinkSummary.tsx](src/components/MagicLinkSummary.tsx), [src/components/BehaviorCharts.tsx](src/components/BehaviorCharts.tsx), [src/components/BehaviorOverTimeChart.tsx](src/components/BehaviorOverTimeChart.tsx), [src/components/CoteacherWritePanel.tsx](src/components/CoteacherWritePanel.tsx) |
| Admin UIs | [app/admin/requests/RequestsClient.tsx](app/admin/requests/RequestsClient.tsx), [app/admin/teachers/TeachersClient.tsx](app/admin/teachers/TeachersClient.tsx), [app/admin/break-glass/BreakGlassClient.tsx](app/admin/break-glass/BreakGlassClient.tsx), [app/admin/usage/page.tsx](app/admin/usage/page.tsx), [app/admin/upload-schedule/page.tsx](app/admin/upload-schedule/page.tsx), [app/admin/audit-log/page.tsx](app/admin/audit-log/page.tsx), [app/audit/me/page.tsx](app/audit/me/page.tsx) |
| Shared UI components | [src/components/](src/components/) — Splash, SplashGate, ActAsBanner, ActAsExitButton, SignOutButton, SiteAdminNav, ManageLinksModal, ScheduleUploader, AuditRowList, PWAProvider |
| Static pages | [app/privacy/page.tsx](app/privacy/page.tsx), [app/pending/PendingClient.tsx](app/pending/PendingClient.tsx), [app/access-denied/page.tsx](app/access-denied/page.tsx) |
| Design system / styling | [app/globals.css](app/globals.css) (Sure Step `--ssd-*` tokens), [app/layout.tsx](app/layout.tsx) (DM fonts, SplashGate), [Sure_Step_Education_Aesthetic.md](Sure_Step_Education_Aesthetic.md) (canonical aesthetic) |
| PWA | [public/manifest.json](public/manifest.json), [public/sw.js](public/sw.js), [src/components/PWAProvider.jsx](src/components/PWAProvider.jsx) |

Front-end gotchas: Recharts and jspdf/jspdf-autotable are **browser-only** — Recharts stays behind `dynamic(..., { ssr: false })`; jspdf is lazy-imported inside event handlers. See [CLAUDE.md](CLAUDE.md) Critical Gotchas.

## Back end — auth, data, and server logic

Route handlers, server components' data access, Supabase, migrations.

| Area | Files |
|---|---|
| Auth flow | [app/auth/callback/route.ts](app/auth/callback/route.ts) (OAuth), [app/auth/confirm/route.ts](app/auth/confirm/route.ts) (cross-device magic link), [app/auth/home/route.ts](app/auth/home/route.ts) (role-aware landing), [src/lib/auth-provision.ts](src/lib/auth-provision.ts) (shared provisioning gate), [proxy.ts](proxy.ts) (session-refresh middleware, Next 16 name) |
| API routes | [app/api/](app/api/) — admin (approve/deny, act-as, break-glass, invites, teacher-active, districts/schools/teachers), access-request, audit events, demo seed/wipe, schedule parse (Anthropic AI) + save, refresh-google-token, check-allowed (vestigial) |
| Supabase clients (the picker rule) | [src/lib/supabase.ts](src/lib/supabase.ts) (browser anon) · [src/lib/supabase-server.ts](src/lib/supabase-server.ts) (cookie-aware server) · [src/lib/supabase-admin.ts](src/lib/supabase-admin.ts) (service role — **server-only, bypasses RLS**) |
| Server libraries | [src/lib/](src/lib/) — act-as-current/scope, audit-log + audit-log-query + audit-event-client, demo-seed, schedule-shape + schedules-schema + use-schedules, send-teacher-invite (Resend), notify-new-access-request |
| Database (the real back end) | [supabase/migrations/](supabase/migrations/) 001–040 — schema, RLS policies, SECURITY DEFINER RPCs (magic-link views, co-teacher writes, invites, usage rollups), audit triggers. **Source of truth for all access control.** |

Back-end gotchas: schema changes are **new numbered migrations only** (never edit old ones, snapshot before prod mutation); `createAdminClient` never gets imported into client code; `auth.uid()` for attribution vs `effective_user_id()` for data access.

## The seam between them

Front end talks to back end three ways — when changing a contract, check both sides:

1. **Supabase RPCs from the browser** (anon client): magic-link views (`get_parent_view`/`get_student_view`/`get_coteacher_view`), co-teacher writes (`coteacher_write_score`/`_note`). Contract lives in the migration that defines the RPC.
2. **Internal API routes** (`fetch('/api/...')`) from dashboard/admin UIs.
3. **Direct table reads under RLS** (browser anon client) — e.g., the dashboard reading scores. RLS policies in migrations are the contract.

## Branch workflow

- **`main`** — always deployable; Vercel auto-deploys every push to prod (dailywins.school). Nothing lands here broken.
- **`frontend`** — working branch for UI work (pages, components, styling, charts, PDFs).
- **`backend`** — working branch for server/data work (API routes, auth, src/lib server code, migrations).

Cycle: branch from fresh `main` → work → `npm run build` green → merge to `main` → push (deploys) → refresh your working branch from `main` (`git checkout frontend && git merge main`). Small/urgent fixes can still go straight to `main`. If one change spans both sides (e.g., a new RPC + the UI that calls it), do it as one branch off `main` — don't split a single feature across the two branches.
