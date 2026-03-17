-- ============================================
-- PR HISTORY (separate from client_prs)
-- ============================================
CREATE TABLE IF NOT EXISTS pr_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight_kg DECIMAL(6,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pr_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own pr history" ON pr_history FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view client pr history" ON pr_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM trainer_clients tc WHERE tc.trainer_id = auth.uid() AND tc.client_id = pr_history.client_id)
);
GRANT ALL ON pr_history TO authenticated;

-- ============================================
-- IN-APP NOTIFICATIONS (bell icon system)
-- ============================================
-- notifications table already exists, let's use it
-- Just ensure it has the right columns
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

NOTIFY pgrst, 'reload schema';
