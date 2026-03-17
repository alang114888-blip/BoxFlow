-- Add is_onboarded flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT false;

-- Mark existing admins as onboarded
UPDATE profiles SET is_onboarded = true WHERE role = 'super_admin';
