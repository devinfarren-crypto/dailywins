# DailyWins Field Guide — the 8pm-service-call one-pager

For Devin (and Nick). How the whole endeavor is laid out, and how to talk to
Claude about any piece of it without ambiguity. Lives in the repo so it's on
both machines after `git pull`.

## The estate — four things, four jobs

```
Desktop/SURE STEP EDUCATION/
│
├── dailywins-app/          🏠 THE PRODUCT — the only code customers touch
│                              One app, ALL customers (NPS + districts)
│                              git → Vercel → dailywins.school
│
├── dailywins-marketing/    📣 THE SALES KIT — never touches the product
│   ├── website/               → dailywins-schools.vercel.app (own Vercel project)
│   └── slide-deck/ demo/ emails/ pricing/
│
├── surestep-site/          🏢 COMPANY HOMEPAGE — Netlify; local copy is stale,
│                              do NOT redeploy it casually
└── (DPA templates, videos…)   loose business files
```

## The one mental model that matters

**NPS vs. district is not a place in the code — it's a property of the
customer in the database.** There is no NPS folder, no district branch.
One codebase; the organization row (`org_type: 'nps' | 'district'`) decides
what each customer sees and what their roles are called.

```
                 dailywins-app (one codebase, one branch: main)
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   org_type = 'nps'             org_type = 'district'
   Director                     District admin
    └─ ~10 teachers              └─ Site admins
   family links optional             └─ Teachers
                                family links standard
```

Inside the app, front end vs back end is mapped file-by-file in
[ARCHITECTURE.md](ARCHITECTURE.md).

## The service-call protocol

1. **Name the school or person — that's usually all Claude needs.**
   "Bright Path's director says the weekly PDF cut off a goal" → Claude looks
   the org up in the database, sees its org_type, and knows the whole shape
   (who the director is, how many teachers, which features they use).
2. **No school to name? Two prefixes cover everything:**
   - `NPS:` or `District:` — product behavior for one customer shape
   - `Kit:` — marketing materials, not the product
3. **Describe the symptom like you'd repeat the phone call.** Who saw it,
   what page, what they expected. Claude triages from the data — you don't
   need to guess which code is involved.

## Why one chat is safe

The chat is disposable; **the system is files.** Every session reboots from:

| File | What it holds |
|---|---|
| [CLAUDE.md](CLAUDE.md) | The standing rules + gotchas |
| [ROADMAP.md](ROADMAP.md) | What's shipped, what's open, pilot status |
| [HANDOFF.md](HANDOFF.md) | Cross-machine session handoff (the passphrase ritual) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Front-end/back-end code map + branch workflow |
| `~/.claude/.../memory/` | Claude's own notes (preferences, guardrails) — this machine only |

Typing **`sync`** at the end of a session is the save button: it refreshes
HANDOFF + ROADMAP, commits, and pushes. Nothing important lives only in a
conversation.

## Where things run (when something is "down")

| Surface | URL | Runs on |
|---|---|---|
| The app (prod) | dailywins.school | Vercel ← `main` (auto-deploy on push) |
| Database / auth | — | Supabase `kvbpfvazddlmoxobqfev` (us-east-1), migrations 001–045 |
| NPS marketing site | dailywins-schools.vercel.app | Vercel project `dailywins-schools` (separate) |
| Company homepage | surestepeducation.com | Netlify (behind Cloudflare) |
| Email (invites, approvals, notifications) | send.dailywins.school | Resend |
