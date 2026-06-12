# NPS Director Outreach — the system

*Built 2026-06-12. One personalized email per school: a gift (their homepage,
rebuilt), a frictionless demo (no signup), and a 10-second reply path to a
free pilot. First send: The Phillips Academy → devinfarren@gmail.com (dry run).*

## The shape of one outreach

Every school gets three artifacts, all hosted on dailywins.school:

| Artifact | Where | What it is |
|---|---|---|
| Pitch page | `public/for/<slug>/index.html` | Personalized landing: their mission in the hero, the gift card, the inline tap-to-win demo, the founding-rate offer. `noindex`. |
| Homepage refresh | `public/for/<slug>/site/index.html` | A genuinely good concept rebuild of THEIR front page — their colors, mission, tagline. Free, no strings, photo slots are placeholders (never lift photos of real students). |
| Email preview | `public/for/<slug>/preview.png` | Above-the-fold screenshot of the refresh, embedded in the email. |

The email itself is rendered by [src/lib/outreach-email.ts](../src/lib/outreach-email.ts)
and sent by `POST /api/outreach/send` (Resend, from the verified
send.dailywins.school domain, presented as "Devin Farren · DailyWins",
reply-to support@surestepeducation.com).

## Sending (founder machines only)

```bash
node scripts/send-outreach.mjs ../dailywins-marketing/outreach/<school>.json
# dry-run to yourself first:
node scripts/send-outreach.mjs <config> --to devinfarren@gmail.com
```

Auth: the script reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` and the
route compares it server-side — holders of the founder key are exactly the
people allowed to send sales mail as Devin.

Config format (keep real-prospect configs in `dailywins-marketing/outreach/`,
NOT in this public repo):

```json
{
  "to": "director@school.org",
  "school": {
    "name": "The Phillips Academy",
    "slug": "phillips-academy",
    "directorFirstName": "",
    "estLine": "Est. 1971",
    "missionHook": "One sentence tying DailyWins to THEIR published mission."
  }
}
```

## The playbook for school #2..#260

1. **Research (10 min):** their website → mission statement, founding year,
   mascot, colors, director name. The missionHook is the one hand-written
   sentence — it's what makes the email feel human. Everything else templates.
2. **Build the refresh:** copy `public/for/phillips-academy/site/` as the
   starting point; swap palette, name, mission, tagline, announcements.
   Placeholder photo slots stay (never scrape their student photos).
3. **Build the pitch page:** copy `public/for/phillips-academy/index.html`;
   swap the hero personalization + demo room name + offer copy.
4. **Preview image:** `Chrome --headless --screenshot=public/for/<slug>/preview.png
   --window-size=1200,860 file://.../site/index.html`.
5. **Ship:** commit, push, confirm the Vercel deploy, click every link.
6. **Send to yourself first** (`--to devinfarren@gmail.com`), read it on a
   phone, THEN send to the director.
7. Log the send (date, school, email) in `dailywins-marketing/outreach/log.md`.

## Rules

- **One email.** The compliance footer promises "reply 'no thanks' and you'll
  never hear from me again" — honor it; track opt-outs in the log.
- **Never claim what isn't true.** Founding-rate seats are really 15; the
  pilot really is free and doesn't auto-convert; we really will hand over the
  website files.
- **No real student imagery, ever** — placeholder slots only.
- **Every link verified post-deploy before any send.** A 404 in a cold email
  is fatal.
- The pitch pages are `noindex` and excluded from any sitemap — they're
  private letters, not marketing pages.
