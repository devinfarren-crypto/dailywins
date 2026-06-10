-- Migration 045: short branded invite sign-in links
--
-- The single-email invite (dbf284b) embedded the raw /auth/confirm token URL —
-- functional, but an alphabet-soup link in the email. Now the invite email
-- carries dailywins.school/welcome/<short-code> instead; this table maps the
-- code to the minted one-time token server-side.
--
--   - code: 12-char base64url (72 bits) — unguessable, pretty
--   - single use (used_at) + 24h expiry, matching the OTP's own lifetime
--   - service-role only: RLS enabled with NO policies; only the invite route
--     (insert) and the /welcome route (select/update) touch it, both server-side
--
-- The /welcome page is also an interstitial (button POST → verify), so mail
-- scanners that prefetch GET links can't consume the one-time token.
--
-- Rollback: drop table public.invite_signin_links;

create table if not exists public.invite_signin_links (
  code        text primary key,
  token_hash  text not null,
  otp_type    text not null,
  email       text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  used_at     timestamptz
);

alter table public.invite_signin_links enable row level security;
-- no grants, no policies: service-role access only.
