-- ============================================
-- WORKOUT SECTIONS (within a workout day)
-- ============================================
CREATE TYPE section_type AS ENUM ('warmup', 'strength', 'cardio', 'metcon', 'other');

ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS section section_type DEFAULT 'other';
ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS section_order INT DEFAULT 0;

-- ============================================
-- WOD (Workout of the Day)
-- ============================================
CREATE TABLE wods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  section section_type DEFAULT 'metcon',
  workout_details JSONB,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage own wods" ON wods
  FOR ALL USING (auth.uid() = trainer_id);

CREATE POLICY "Clients can view their trainer wods" ON wods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.client_id = auth.uid() AND tc.trainer_id = wods.trainer_id
    )
  );

CREATE POLICY "Super admins can view all wods" ON wods
  FOR SELECT USING (public.get_my_role() = 'super_admin');

-- ============================================
-- WOD RESULTS (client scores)
-- ============================================
CREATE TABLE wod_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wod_id UUID NOT NULL REFERENCES wods(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score TEXT,
  time_seconds INT,
  rx BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wod_id, client_id)
);

ALTER TABLE wod_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own wod results" ON wod_results
  FOR ALL USING (auth.uid() = client_id);

CREATE POLICY "Trainers can view their client wod results" ON wod_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wods w
      WHERE w.id = wod_results.wod_id AND w.trainer_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can view all wod results" ON wod_results
  FOR SELECT USING (public.get_my_role() = 'super_admin');

-- ============================================
-- ADMIN/TRAINER SET PASSWORD FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.set_user_password(target_user_id UUID, new_password TEXT)
RETURNS void AS $$
BEGIN
  UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- GRANTS
-- ============================================
GRANT ALL ON wods TO anon, authenticated;
GRANT ALL ON wod_results TO anon, authenticated;
