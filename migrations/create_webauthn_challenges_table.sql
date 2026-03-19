-- Create webauthn_challenges table for server-side challenge storage
-- Required by WebAuthn spec: challenges must be verified against server-stored values
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  challenge text NOT NULL,
  type text NOT NULL CHECK (type IN ('authentication', 'registration')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false
);

-- Index for lookup by member_id + type (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_member_type
  ON webauthn_challenges (member_id, type, used)
  WHERE used = false;

-- Auto-cleanup: delete expired challenges older than 1 hour past expiry
-- (handled by application code or a cron job)

-- RLS: only service role should access this table.
-- No policies are defined, so non-service-role access is denied by default (Supabase deny-all).
-- Service role (used by API routes) bypasses RLS entirely.
-- Do NOT add permissive policies unless explicitly required.
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Rollback:
-- DROP TABLE IF EXISTS webauthn_challenges;
