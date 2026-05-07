-- ── Worker portal token columns ───────────────────────────────────────────────
-- Adds magic-link portal access columns to staff_profiles.
-- Tokens are never stored raw — only the SHA-256 hash is persisted.

alter table staff_profiles
  add column if not exists portal_token_hash       text,
  add column if not exists portal_token_expires_at  timestamptz,
  add column if not exists portal_last_login_at     timestamptz;

create index if not exists staff_profiles_portal_token_hash_idx
  on staff_profiles (portal_token_hash)
  where portal_token_hash is not null;
