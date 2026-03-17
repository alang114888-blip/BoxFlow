-- ============================================
-- NUTRITIONIST CLIENT FEATURES
-- ============================================

-- Weight logs (daily tracking)
CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_kg DECIMAL(5,1) NOT NULL,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, logged_at)
);
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own weight logs" ON weight_logs FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view client weight logs" ON weight_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM trainer_clients tc WHERE tc.trainer_id = auth.uid() AND tc.client_id = weight_logs.client_id)
);

-- Progress photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  taken_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own photos" ON progress_photos FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view client photos" ON progress_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM trainer_clients tc WHERE tc.trainer_id = auth.uid() AND tc.client_id = progress_photos.client_id)
);

-- Daily mood check-ins
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood_emoji TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date)
);
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own daily checkins" ON daily_checkins FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view client daily checkins" ON daily_checkins FOR SELECT USING (
  EXISTS (SELECT 1 FROM trainer_clients tc WHERE tc.trainer_id = auth.uid() AND tc.client_id = daily_checkins.client_id)
);

-- Water intake logs
CREATE TABLE IF NOT EXISTS water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  glasses INT NOT NULL DEFAULT 0,
  goal INT NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date)
);
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can manage own water logs" ON water_logs FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view client water logs" ON water_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM trainer_clients tc WHERE tc.trainer_id = auth.uid() AND tc.client_id = water_logs.client_id)
);

-- Add nutritionist fields to trainer_clients
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS weigh_in_day TEXT;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS weigh_in_reminder_time TIME;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS personal_notes TEXT;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS next_appointment TIMESTAMPTZ;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS motivation_message TEXT;
ALTER TABLE trainer_clients ADD COLUMN IF NOT EXISTS water_goal INT DEFAULT 8;

-- Grants
GRANT ALL ON weight_logs TO authenticated;
GRANT ALL ON progress_photos TO authenticated;
GRANT ALL ON daily_checkins TO authenticated;
GRANT ALL ON water_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
