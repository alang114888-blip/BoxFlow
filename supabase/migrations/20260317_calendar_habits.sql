-- Calendar: add start_date to workout_plans
ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS start_date DATE;

-- Habits
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '✅',
  frequency TEXT DEFAULT 'daily',
  days_of_week TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainers can manage habits" ON habits FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Clients can view own habits" ON habits FOR SELECT USING (auth.uid() = client_id);

-- Habit logs
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, logged_date)
);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own habit logs" ON habit_logs FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view client habit logs" ON habit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM habits h WHERE h.id = habit_logs.habit_id AND h.trainer_id = auth.uid())
);

GRANT ALL ON habits TO authenticated;
GRANT ALL ON habit_logs TO authenticated;
NOTIFY pgrst, 'reload schema';
