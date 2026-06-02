# Resend / Email Delivery Setup

Wiring Resend turns on two things that are currently dormant:

1. **Founder notification email** when a new access request lands. The code is
   already wired — [src/lib/notify-new-access-request.ts](../src/lib/notify-new-access-request.ts),
   called from [app/auth/callback/route.ts](../app/auth/callback/route.ts). It
   **no-ops silently** until `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` +
   `NOTIFY_TO_EMAIL` are set. `resend@^6.12.4` is already a dependency. No code
   change needed — this is pure config.
2. **Supabase custom SMTP** so magic-link / auth emails stop using Supabase's
   rate-limited, spam-prone built-in sender and go out through Resend instead.

> Verified against the code path 2026-06-02. Only Devin can do the DNS + dashboard steps.

## Prerequisites
- DNS access for `dailywins.school` (registrar / DNS provider).
- Vercel project access (env vars).
- Supabase dashboard access (project `kvbpfvazddlmoxobqfev` → Auth).

---

## Step 1 — Resend account + verify the domain
1. Sign up at **resend.com**.
2. **Domains → Add Domain.** Use `dailywins.school` (or a sending subdomain like
   `send.dailywins.school` to insulate the root domain's reputation — optional but recommended).
3. Resend shows the **DNS records to add** — add them at your DNS provider exactly as shown:
   - **MX** record (for the sending subdomain) — bounce/feedback handling.
   - **SPF** (TXT) — authorizes Resend/SES to send for the domain.
   - **DKIM** (CNAME or TXT, 1–3 records) — signs your mail.
   - **DMARC** (TXT, recommended): start with `v=DMARC1; p=none; rua=mailto:devin@surestepeducation.com`.
   ⚠️ Use the **exact values from Resend's dashboard**, not examples.
4. Wait for propagation (minutes to ~1 hour). Resend flips the domain to **Verified**.

## Step 2 — Create an API key
**Resend → API Keys → Create API Key** (name e.g. "DailyWins prod"). Copy the
`re_...` value now — it's shown only once.

## Step 3 — Vercel env vars (turns on the founder notification)
**Vercel → Project → Settings → Environment Variables** (Production; add Preview too if you want):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | the `re_...` key |
| `NOTIFY_FROM_EMAIL` | a sender on the verified domain, e.g. `DailyWins <noreply@dailywins.school>` |
| `NOTIFY_TO_EMAIL` | where founder alerts go, e.g. `devin@surestepeducation.com` |

Then **redeploy** (env vars only apply to new deployments).

**Test:** have a throwaway email request access → you should receive
"New DailyWins beta request: …". If nothing arrives, confirm all three vars are
set **and** you redeployed (the code no-ops if any one is missing).

## Step 4 — Supabase custom SMTP (turns on real magic-link delivery)
1. Resend SMTP credentials:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL) or `587` (TLS)
   - **Username:** `resend`
   - **Password:** your `re_...` API key
2. **Supabase Dashboard → Authentication → Emails → SMTP Settings → Enable Custom SMTP:**
   - Sender email: `noreply@dailywins.school` (must be on the verified domain)
   - Sender name: `DailyWins`
   - Host / Port / Username / Password as above
3. Save. Then **Auth → Rate Limits** — raise the email rate limit now that you're
   off the shared sender.
4. (Optional) **Auth → Email Templates** — brand the magic-link email.

**Test:** trigger a magic-link sign-in to a real inbox → confirm it lands (check
spam, and Resend's dashboard **Logs** for delivery status).

---

## Gotchas
- The `From` address **must** be on the Resend-verified domain or sends are rejected.
- Keep DMARC at `p=none` until deliverability looks good, then consider `p=quarantine`.
- This is the EGUSD/tester-growth blocker: until Step 4, magic-link sign-ups are
  throttled by Supabase's built-in sender.
