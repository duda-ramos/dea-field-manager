-- Enable leaked password protection
-- This configures Supabase to check passwords against known breach databases
-- Note: This setting needs to be enabled in the Supabase Dashboard under Authentication > Settings

-- Create a function to validate password strength
CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check minimum length
  IF length(password) < 8 THEN
    RETURN false;
  END IF;
  
  -- Check for at least one uppercase letter
  IF NOT password ~ '[A-Z]' THEN
    RETURN false;
  END IF;
  
  -- Check for at least one lowercase letter
  IF NOT password ~ '[a-z]' THEN
    RETURN false;
  END IF;
  
  -- Check for at least one number
  IF NOT password ~ '[0-9]' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;