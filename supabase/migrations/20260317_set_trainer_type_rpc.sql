-- RPC to set trainer type (bypasses RLS, runs as SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.set_trainer_type(target_user_id UUID, new_type TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO public.trainer_profiles (user_id, trainer_type)
  VALUES (target_user_id, new_type::trainer_type)
  ON CONFLICT (user_id)
  DO UPDATE SET trainer_type = new_type::trainer_type, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
