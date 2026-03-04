
-- Create a function to add admin role by email (uses service role internally)
CREATE OR REPLACE FUNCTION public.add_admin_by_email(admin_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Only existing admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Find user by email in auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = admin_email LIMIT 1;

  IF target_user_id IS NULL THEN
    -- Also update the trigger function to include this email for future signups
    RETURN 'USER_NOT_FOUND';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN 'OK';
END;
$$;
