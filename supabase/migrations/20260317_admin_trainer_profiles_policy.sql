-- Allow super_admin to manage all trainer_profiles
-- (The existing policy only allows trainers to manage their own)
DO $$ BEGIN
  CREATE POLICY "Super admins can update trainer profiles" ON trainer_profiles
    FOR UPDATE USING (public.get_my_role() = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Super admins can insert trainer profiles" ON trainer_profiles
    FOR INSERT WITH CHECK (public.get_my_role() = 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
