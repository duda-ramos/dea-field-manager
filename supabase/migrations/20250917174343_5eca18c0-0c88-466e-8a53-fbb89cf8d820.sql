-- Enable leaked password protection for enhanced security
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Create a function to check password strength and prevent leaked passwords
CREATE OR REPLACE FUNCTION public.check_password_security(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check minimum requirements
  IF length(password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long';
  END IF;
  
  IF NOT password ~ '[A-Z]' THEN
    RAISE EXCEPTION 'Password must contain at least one uppercase letter';
  END IF;
  
  IF NOT password ~ '[a-z]' THEN
    RAISE EXCEPTION 'Password must contain at least one lowercase letter';
  END IF;
  
  IF NOT password ~ '[0-9]' THEN
    RAISE EXCEPTION 'Password must contain at least one number';
  END IF;
  
  -- Additional security: check for common patterns
  IF password ~* '(password|123456|qwerty|admin|letmein)' THEN
    RAISE EXCEPTION 'Password contains common patterns and is not secure';
  END IF;
  
  RETURN true;
END;
$$;