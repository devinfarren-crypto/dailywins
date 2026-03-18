# DailyWins

Classroom behavior tracking app for school districts. Migrating from a Google Apps Script prototype.

**Production URL:** dailywins.school

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4
- **Backend/DB:** Supabase (Postgres, Auth, Realtime)
- **Auth:** Google SSO via Supabase Auth
- **Deployment:** Vercel
- **Package manager:** npm

## Project Structure

```
app/           → Next.js App Router pages and layouts
public/        → Static assets
```

Uses `@/*` path alias mapping to the project root.

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

- 8 periods per day
- Each behavior is a binary win (yes/no) per period
- Teachers log in via Google SSO (school Google accounts)

## Key Conventions

- Use Server Components by default; add `"use client"` only when needed
- Supabase client: use `createServerClient` in Server Components/Route Handlers, `createBrowserClient` in Client Components
- All database access goes through Supabase (no direct Postgres connections)
- Keep components in `app/` following Next.js App Router colocation patterns
- Use TypeScript strict mode — no `any` types
