-- ============================================
-- SECURITY: Rate limiting, account locking, password history
-- ============================================

-- Add security columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Password history table
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- Only the system (SECURITY DEFINER functions) can manage password history
CREATE POLICY "No direct access to password history" ON password_history
  FOR ALL USING (false);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Record failed login attempt, lock after 5
CREATE OR REPLACE FUNCTION public.record_failed_login(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  target_profile RECORD;
BEGIN
  SELECT p.id, p.failed_attempts, p.locked_at INTO target_profile
  FROM public.profiles p WHERE p.email = user_email;

  IF target_profile.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF target_profile.locked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'locked', 'locked_at', target_profile.locked_at);
  END IF;

  UPDATE public.profiles
  SET failed_attempts = failed_attempts + 1,
      locked_at = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() ELSE NULL END
  WHERE id = target_profile.id;

  IF target_profile.failed_attempts + 1 >= 5 THEN
    RETURN jsonb_build_object('status', 'locked', 'attempts', target_profile.failed_attempts + 1);
  END IF;

  RETURN jsonb_build_object('status', 'failed', 'attempts', target_profile.failed_attempts + 1, 'remaining', 5 - (target_profile.failed_attempts + 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Clear failed attempts on successful login
CREATE OR REPLACE FUNCTION public.clear_failed_login(user_email TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles SET failed_attempts = 0 WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if account is locked
CREATE OR REPLACE FUNCTION public.check_account_locked(user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  target_profile RECORD;
BEGIN
  SELECT locked_at, failed_attempts INTO target_profile
  FROM public.profiles WHERE email = user_email;

  IF target_profile.locked_at IS NOT NULL THEN
    RETURN jsonb_build_object('locked', true, 'locked_at', target_profile.locked_at);
  END IF;

  RETURN jsonb_build_object('locked', false, 'attempts', COALESCE(target_profile.failed_attempts, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Unlock account (admin/trainer use)
CREATE OR REPLACE FUNCTION public.unlock_account(target_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET failed_attempts = 0, locked_at = NULL
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check password history (returns true if password was used before)
CREATE OR REPLACE FUNCTION public.check_password_history(target_user_id UUID, new_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  hist RECORD;
BEGIN
  FOR hist IN
    SELECT password_hash FROM password_history
    WHERE user_id = target_user_id
    ORDER BY created_at DESC LIMIT 5
  LOOP
    IF hist.password_hash = crypt(new_password, hist.password_hash) THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Save password to history
CREATE OR REPLACE FUNCTION public.save_password_history(target_user_id UUID, new_password TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO password_history (user_id, password_hash)
  VALUES (target_user_id, crypt(new_password, gen_salt('bf')));

  -- Keep only last 5
  DELETE FROM password_history
  WHERE id IN (
    SELECT id FROM password_history
    WHERE user_id = target_user_id
    ORDER BY created_at DESC
    OFFSET 5
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grants
GRANT ALL ON password_history TO authenticated;

NOTIFY pgrst, 'reload schema';
