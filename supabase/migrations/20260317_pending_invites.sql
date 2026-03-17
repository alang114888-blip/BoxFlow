-- Pending invites (before client creates account)
CREATE TABLE IF NOT EXISTS pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, email)
);

ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainers can manage own invites" ON pending_invites FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Anyone can read invites by email" ON pending_invites FOR SELECT USING (true);
GRANT ALL ON pending_invites TO anon, authenticated;

-- Make client_id nullable in trainer_clients (for backward compat)
ALTER TABLE trainer_clients ALTER COLUMN client_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
