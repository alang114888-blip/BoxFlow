-- BoxFlow: Full Supabase SQL Schema with RLS
-- Tables created first, then RLS policies added after (to avoid forward-reference issues)

-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE user_role AS ENUM ('super_admin', 'trainer', 'client');
CREATE TYPE trainer_type AS ENUM ('fitness', 'nutrition', 'both');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- ============================================
-- ALL TABLES (no policies yet)
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trainer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  trainer_type trainer_type NOT NULL DEFAULT 'fitness',
  bio TEXT,
  specializations TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trainer_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_email TEXT,
  invite_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, client_id)
);

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  video_url TEXT,
  is_pr_eligible BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_prs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight_kg DECIMAL(6,2) NOT NULL,
  date_achieved DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, exercise_id)
);

CREATE TABLE workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workout_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_of_week day_of_week,
  session_number INT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  sets INT NOT NULL DEFAULT 3,
  reps TEXT NOT NULL DEFAULT '10',
  percentage_of_pr DECIMAL(5,2),
  manual_weight_kg DECIMAL(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE nutrition_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  day_of_week day_of_week,
  day_number INT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nutrition_day_id UUID NOT NULL REFERENCES nutrition_days(id) ON DELETE CASCADE,
  meal_type meal_type NOT NULL,
  name TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  quantity TEXT,
  calories INT,
  protein_g DECIMAL(6,1),
  carbs_g DECIMAL(6,1),
  fat_g DECIMAL(6,1),
  notes TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  score INT,
  duration_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workout_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  actual_weight_kg DECIMAL(6,2),
  actual_reps TEXT,
  actual_sets INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_name TEXT,
  status TEXT DEFAULT 'active',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_participants INT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'booked',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  status TEXT DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schema JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE programs_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_prs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs_marketplace ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION (avoids infinite recursion on profiles RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ALL RLS POLICIES
-- ============================================

-- profiles (use get_my_role() to avoid infinite recursion)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Super admins can view all profiles" ON profiles
  FOR SELECT USING (public.get_my_role() = 'super_admin');
CREATE POLICY "Trainers can view their clients profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.trainer_id = auth.uid() AND tc.client_id = profiles.id
    )
  );
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admins can update all profiles" ON profiles
  FOR UPDATE USING (public.get_my_role() = 'super_admin');
CREATE POLICY "Allow insert for authenticated users" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- trainer_profiles
CREATE POLICY "Trainers can manage own profile" ON trainer_profiles
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage all trainer profiles" ON trainer_profiles
  FOR ALL USING (
    public.get_my_role() = 'super_admin'
  );
CREATE POLICY "Clients can view their trainer profile" ON trainer_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.client_id = auth.uid() AND tc.trainer_id = trainer_profiles.user_id
    )
  );

-- trainer_clients
CREATE POLICY "Trainers can manage their client relationships" ON trainer_clients
  FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Clients can view their trainer relationship" ON trainer_clients
  FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Super admins can manage all relationships" ON trainer_clients
  FOR ALL USING (
    public.get_my_role() = 'super_admin'
  );

-- exercises
CREATE POLICY "Trainers can manage own exercises" ON exercises
  FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Clients can view their trainer exercises" ON exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.client_id = auth.uid() AND tc.trainer_id = exercises.trainer_id
    )
  );
CREATE POLICY "Super admins can view all exercises" ON exercises
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- client_prs
CREATE POLICY "Clients can manage own PRs" ON client_prs
  FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view their client PRs" ON client_prs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.trainer_id = auth.uid() AND tc.client_id = client_prs.client_id
    )
  );
CREATE POLICY "Super admins can view all PRs" ON client_prs
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- workout_plans
CREATE POLICY "Trainers can manage their workout plans" ON workout_plans
  FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Clients can view own workout plans" ON workout_plans
  FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Super admins can view all workout plans" ON workout_plans
  FOR ALL USING (
    public.get_my_role() = 'super_admin'
  );

-- workout_days
CREATE POLICY "Trainers can manage workout days" ON workout_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_plans wp WHERE wp.id = workout_days.plan_id AND wp.trainer_id = auth.uid()
    )
  );
CREATE POLICY "Clients can view own workout days" ON workout_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_plans wp WHERE wp.id = workout_days.plan_id AND wp.client_id = auth.uid()
    )
  );
CREATE POLICY "Super admins can view all workout days" ON workout_days
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- workout_exercises
CREATE POLICY "Trainers can manage workout exercises" ON workout_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_days wd
      JOIN workout_plans wp ON wp.id = wd.plan_id
      WHERE wd.id = workout_exercises.workout_day_id AND wp.trainer_id = auth.uid()
    )
  );
CREATE POLICY "Clients can view own workout exercises" ON workout_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_days wd
      JOIN workout_plans wp ON wp.id = wd.plan_id
      WHERE wd.id = workout_exercises.workout_day_id AND wp.client_id = auth.uid()
    )
  );
CREATE POLICY "Super admins can view all workout exercises" ON workout_exercises
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- nutrition_plans
CREATE POLICY "Trainers can manage nutrition plans" ON nutrition_plans
  FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Clients can view own nutrition plans" ON nutrition_plans
  FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Super admins can view all nutrition plans" ON nutrition_plans
  FOR ALL USING (
    public.get_my_role() = 'super_admin'
  );

-- nutrition_days
CREATE POLICY "Trainers can manage nutrition days" ON nutrition_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nutrition_plans np WHERE np.id = nutrition_days.plan_id AND np.trainer_id = auth.uid()
    )
  );
CREATE POLICY "Clients can view own nutrition days" ON nutrition_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nutrition_plans np WHERE np.id = nutrition_days.plan_id AND np.client_id = auth.uid()
    )
  );
CREATE POLICY "Super admins can view all nutrition days" ON nutrition_days
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- meals
CREATE POLICY "Trainers can manage meals" ON meals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nutrition_days nd
      JOIN nutrition_plans np ON np.id = nd.plan_id
      WHERE nd.id = meals.nutrition_day_id AND np.trainer_id = auth.uid()
    )
  );
CREATE POLICY "Clients can view own meals" ON meals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nutrition_days nd
      JOIN nutrition_plans np ON np.id = nd.plan_id
      WHERE nd.id = meals.nutrition_day_id AND np.client_id = auth.uid()
    )
  );
CREATE POLICY "Super admins can view all meals" ON meals
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- meal_items
CREATE POLICY "Trainers can manage meal items" ON meal_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN nutrition_days nd ON nd.id = m.nutrition_day_id
      JOIN nutrition_plans np ON np.id = nd.plan_id
      WHERE m.id = meal_items.meal_id AND np.trainer_id = auth.uid()
    )
  );
CREATE POLICY "Clients can view own meal items" ON meal_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN nutrition_days nd ON nd.id = m.nutrition_day_id
      JOIN nutrition_plans np ON np.id = nd.plan_id
      WHERE m.id = meal_items.meal_id AND np.client_id = auth.uid()
    )
  );
CREATE POLICY "Super admins can view all meal items" ON meal_items
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- workout_logs
CREATE POLICY "Clients can manage own logs" ON workout_logs
  FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view their client logs" ON workout_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trainer_clients tc
      WHERE tc.trainer_id = auth.uid() AND tc.client_id = workout_logs.client_id
    )
  );
CREATE POLICY "Super admins can view all logs" ON workout_logs
  FOR SELECT USING (
    public.get_my_role() = 'super_admin'
  );

-- workout_results
CREATE POLICY "Clients can manage own results" ON workout_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl WHERE wl.id = workout_results.log_id AND wl.client_id = auth.uid()
    )
  );
CREATE POLICY "Trainers can view their client results" ON workout_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      JOIN trainer_clients tc ON tc.client_id = wl.client_id
      WHERE wl.id = workout_results.log_id AND tc.trainer_id = auth.uid()
    )
  );

-- notifications
CREATE POLICY "Users can manage own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- reactions
CREATE POLICY "Users can manage own reactions" ON reactions FOR ALL USING (auth.uid() = user_id);

-- subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage subscriptions" ON subscriptions FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

-- classes
CREATE POLICY "Trainers can manage own classes" ON classes FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Public can view classes" ON classes FOR SELECT USING (true);

-- class_bookings
CREATE POLICY "Clients can manage own bookings" ON class_bookings FOR ALL USING (auth.uid() = client_id);
CREATE POLICY "Trainers can view class bookings" ON class_bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM classes c WHERE c.id = class_bookings.class_id AND c.trainer_id = auth.uid())
);

-- leads
CREATE POLICY "Trainers can manage own leads" ON leads FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Super admins can manage all leads" ON leads FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

-- forms
CREATE POLICY "Trainers can manage own forms" ON forms FOR ALL USING (auth.uid() = trainer_id);

-- programs_marketplace
CREATE POLICY "Trainers can manage own programs" ON programs_marketplace FOR ALL USING (auth.uid() = trainer_id);
CREATE POLICY "Public can view published programs" ON programs_marketplace FOR SELECT USING (is_published = true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Calculate weight from PR percentage
CREATE OR REPLACE FUNCTION calculate_pr_weight(
  p_client_id UUID,
  p_exercise_id UUID,
  p_percentage DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  pr_weight DECIMAL;
BEGIN
  SELECT weight_kg INTO pr_weight
  FROM client_prs
  WHERE client_id = p_client_id AND exercise_id = p_exercise_id;

  IF pr_weight IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN ROUND(pr_weight * p_percentage / 100, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
