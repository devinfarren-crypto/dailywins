-- 026: Add UNIQUE constraint on access_requests.user_id.
--
-- Without it, the upsert(..., { onConflict: "user_id" }) calls in
-- app/auth/callback/route.ts and app/api/access-request/school/route.ts
-- raise "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" and silently fail to insert a row — leaving signed-in users
-- stuck on /pending with no underlying record.
--
-- user_id is nullable; Postgres allows multiple NULLs in a UNIQUE column by
-- default, so legacy-style rows with NULL user_id remain valid.

ALTER TABLE public.access_requests
  ADD CONSTRAINT access_requests_user_id_unique UNIQUE (user_id);
