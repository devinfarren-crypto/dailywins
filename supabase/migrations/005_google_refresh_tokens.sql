-- Store Google OAuth refresh tokens for persistent Drive API access.
-- Refresh tokens don't expire and allow getting new access tokens.

alter table teachers
  add column google_refresh_token text;
