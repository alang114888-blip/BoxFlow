-- Update handle_new_user to also create trainer_profiles for trainers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role public.user_role;
  t_type public.trainer_type;
BEGIN
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role);

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    user_role
  );

  -- Auto-create trainer_profiles for trainers
  IF user_role = 'trainer' THEN
    t_type := COALESCE(
      (NEW.raw_user_meta_data->>'trainer_type')::public.trainer_type,
      'fitness'::public.trainer_type
    );
    INSERT INTO public.trainer_profiles (user_id, trainer_type)
    VALUES (NEW.id, t_type)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
