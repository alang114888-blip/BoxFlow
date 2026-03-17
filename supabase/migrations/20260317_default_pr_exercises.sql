-- ============================================
-- DEFAULT PR EXERCISES
-- ============================================

-- Add is_default flag to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Allow null trainer_id for system exercises
ALTER TABLE exercises ALTER COLUMN trainer_id DROP NOT NULL;

-- Trainer default exercise selections
CREATE TABLE IF NOT EXISTS trainer_default_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, exercise_id)
);

ALTER TABLE trainer_default_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainers can manage own defaults" ON trainer_default_exercises FOR ALL USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_default_exercises TO authenticated;

-- Insert 19 system default PR exercises (trainer_id = null, is_default = true)
INSERT INTO exercises (trainer_id, name, category, is_pr_eligible, is_default) VALUES
  (null, 'Back Squat', 'strength', true, true),
  (null, 'Front Squat', 'strength', true, true),
  (null, 'Deadlift', 'strength', true, true),
  (null, 'Shoulders Press', 'strength', true, true),
  (null, 'Push Press', 'strength', true, true),
  (null, 'Bench Press', 'strength', true, true),
  (null, 'Squat Snatch', 'olympic', true, true),
  (null, 'Power Snatch', 'olympic', true, true),
  (null, 'H.S. Snatch', 'olympic', true, true),
  (null, 'H.P. Snatch', 'olympic', true, true),
  (null, 'OHS', 'olympic', true, true),
  (null, 'Squat Clean', 'olympic', true, true),
  (null, 'Power Clean', 'olympic', true, true),
  (null, 'Clean & Jerk', 'olympic', true, true),
  (null, 'H.S. Clean', 'olympic', true, true),
  (null, 'H.P. Clean', 'olympic', true, true),
  (null, 'Split Jerk', 'olympic', true, true),
  (null, 'Push Jerk', 'olympic', true, true),
  (null, 'Thruster', 'olympic', true, true)
ON CONFLICT DO NOTHING;

-- Allow reading system exercises (trainer_id IS NULL)
CREATE POLICY "Anyone can view system exercises" ON exercises
  FOR SELECT USING (trainer_id IS NULL AND is_default = true);

NOTIFY pgrst, 'reload schema';
