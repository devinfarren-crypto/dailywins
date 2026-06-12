# DailyWins — Subprocessor List

*Vendor packet, drafted 2026-06-11. Update this file (and notify signed LEAs
per the agreement) before adding any new subprocessor.*

| Subprocessor | Purpose | Student data handled | Location | Safeguards |
|---|---|---|---|---|
| **Supabase** (on AWS) | Database, authentication, row-level security | Yes — the system of record (names, behavior marks, notes) | us-east-1 (N. Virginia) | SOC 2 Type II; encryption at rest + TLS; DPA in place |
| **Vercel** | Application hosting / serverless compute | Transit only — requests pass through; no student data stored | US | SOC 2 Type II; DPA in place |
| **Resend** | Transactional email to **staff** (sign-in links, invites, approval notices) | **No** — staff email addresses only; student data never appears in email bodies | US | DPA in place |
| **Anthropic** | AI parsing of school bell-schedule PDFs (documents describing class periods — no student data) | **No** | US | API data not used for model training; zero-retention API tier |
| **Google** (optional) | Staff single-sign-on only | **No** | US | OAuth; no data shared beyond staff identity |

## Commitments

1. **No other third parties** receive data of any kind. There are no analytics
   SDKs, advertising networks, or tracking pixels in the product.
2. **Flow-down:** each subprocessor is bound by terms at least as protective
   as our agreement with the LEA.
3. **Change notice:** signed LEAs are notified in writing before a new
   subprocessor handles student data, with the right to object per the NDPA.
4. **Region:** student data is stored only in the United States.
