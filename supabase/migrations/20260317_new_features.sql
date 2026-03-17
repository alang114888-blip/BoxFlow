-- ============================================
-- NEW FEATURES: Check-ins, Completions, Templates
-- ============================================

-- Weekly Check-ins
CREATE TABLE IF NOT EXISTS weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  weight_kg DECIMAL(5,1),
  energy INT CHECK (energy >= 1 AND energy <= 10),
  sleep INT CHECK (sleep >= 1 AND sleep <= 10),
  stress INT CHECK (stress >= 1 AND stress <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, week_date)
);

ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own checkins" ON weekly_checkins FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view their client checkins" ON weekly_checkins FOR SELECT USING (auth.uid() = trainer_id);
CREATE POLICY "Super admins can view all checkins" ON weekly_checkins FOR SELECT USING (public.get_my_role() = 'super_admin');

-- Workout Completions (Done/Skipped/Pending with feedback)
CREATE TABLE IF NOT EXISTS workout_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('done', 'skipped', 'pending')),
  client_notes TEXT,
  trainer_feedback TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, workout_day_id)
);

ALTER TABLE workout_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own completions" ON workout_completions FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can manage their client completions" ON workout_completions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM trainer_clients tc WHERE tc.trainer_id = auth.uid() AND tc.client_id = workout_completions.client_id
  )
);
CREATE POLICY "Super admins can view all completions" ON workout_completions FOR SELECT USING (public.get_my_role() = 'super_admin');

-- Workout Templates
CREATE TABLE IF NOT EXISTS workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  structure_json JSONB NOT NULL DEFAULT '{}',
  auto_assign BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainers can manage own templates" ON workout_templates FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Super admins can view all templates" ON workout_templates FOR SELECT USING (public.get_my_role() = 'super_admin');

-- Grants
GRANT ALL ON weekly_checkins TO authenticated;
GRANT ALL ON workout_completions TO authenticated;
GRANT ALL ON workout_templates TO authenticated;

NOTIFY pgrst, 'reload schema';
