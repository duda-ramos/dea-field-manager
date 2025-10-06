-- ============================================
-- SECURITY FIX: Protect Customer Contact Information
-- ============================================
-- This migration strengthens security for the contacts table
-- by ensuring proper triggers, constraints, and audit logging

-- 1. Drop existing triggers if they exist (to allow recreation)
DROP TRIGGER IF EXISTS sanitize_contact_data_trigger ON contacts;
DROP TRIGGER IF EXISTS audit_contact_changes_trigger ON contacts;
DROP TRIGGER IF EXISTS audit_contact_access_trigger ON contacts;
DROP TRIGGER IF EXISTS validate_contact_project_access_trigger ON contacts;

-- 2. Update the sanitize function to be more robust
CREATE OR REPLACE FUNCTION public.sanitize_contact_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Trim and sanitize inputs to prevent XSS and injection
  NEW.name = trim(regexp_replace(NEW.name, '\s+', ' ', 'g'));
  
  -- Remove any HTML tags from name
  NEW.name = regexp_replace(NEW.name, '<[^>]*>', '', 'g');
  
  IF NEW.email IS NOT NULL THEN
    NEW.email = lower(trim(NEW.email));
  END IF;
  
  IF NEW.phone IS NOT NULL THEN
    -- Sanitize phone: remove all characters except numbers, +, spaces, (), -
    NEW.phone = regexp_replace(NEW.phone, '[^0-9+\s()-]', '', 'g');
  END IF;
  
  IF NEW.role IS NOT NULL THEN
    NEW.role = trim(NEW.role);
    -- Remove any HTML tags from role
    NEW.role = regexp_replace(NEW.role, '<[^>]*>', '', 'g');
  END IF;
  
  -- Ensure data classification is set
  IF NEW.data_classification IS NULL THEN
    NEW.data_classification = 'personal_data';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Add function to validate project access before contact operations
CREATE OR REPLACE FUNCTION public.validate_contact_project_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user has access to the project before creating/updating contact
  IF NOT user_can_access_project_contacts_secure(NEW.project_id) THEN
    RAISE EXCEPTION 'Access denied: You do not have permission to manage contacts for this project';
  END IF;
  
  -- Ensure user_id matches authenticated user
  IF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: user_id must match authenticated user';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Create triggers in the correct order (BEFORE triggers first)
CREATE TRIGGER validate_contact_project_access_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION validate_contact_project_access();

CREATE TRIGGER sanitize_contact_data_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_contact_data();

CREATE TRIGGER audit_contact_access_trigger
  AFTER INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION audit_contact_access();

CREATE TRIGGER audit_contact_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION audit_contact_changes();

-- 5. Add performance indexes on contact_access_logs
CREATE INDEX IF NOT EXISTS idx_contact_access_logs_user_created 
  ON contact_access_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_access_logs_contact_created 
  ON contact_access_logs(contact_id, created_at DESC);

-- 6. Add email format validation constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_email_format_check'
  ) THEN
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_email_format_check 
      CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;

-- 7. Add phone format validation constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_phone_format_check'
  ) THEN
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_phone_format_check 
      CHECK (phone ~* '^[0-9+\s()-]+$');
  END IF;
END $$;

-- 8. Add table comment documenting security measures
COMMENT ON TABLE contacts IS 'Contains sensitive customer contact information (PII). Protected by RLS policies, input sanitization triggers, audit logging, and access validation. All operations are logged in contact_access_logs table for security monitoring.';