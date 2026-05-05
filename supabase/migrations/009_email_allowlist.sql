-- 009_email_allowlist.sql
-- Closed-pilot email allowlist: only these accounts may complete sign-in.
-- Service role only (auth callback uses createAdminClient to read this).

create table if not exists allowed_emails (
  email      text primary key,
  note       text,
  created_at timestamptz default now()
);

alter table allowed_emails enable row level security;

-- No policies = no anon/authenticated access. Service role bypasses RLS.

insert into allowed_emails (email, note) values
  ('devinfarren@gmail.com',    'Founder'),
  ('mrnickcrabtree@gmail.com', 'Co-founder'),
  ('tommyaskins@gmail.com',    'Co-founder')
on conflict (email) do nothing;
