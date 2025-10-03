-- Create security definer function to get user by email
CREATE OR REPLACE FUNCTION public.get_user_by_email(user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  -- Search for user in auth.users by email
  SELECT id INTO found_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  RETURN found_user_id;
END;
$$;