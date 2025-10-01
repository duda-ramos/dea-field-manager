-- Enhanced security measures for contacts table

-- 1. Add validation constraints for email and phone
ALTER TABLE contacts 
  DROP CONSTRAINT IF EXISTS contacts_email_format_check,
  DROP CONSTRAINT IF EXISTS contacts_phone_format_check,
  DROP CONSTRAINT IF EXISTS contacts_name_length_check;

-- Email validation (if provided)
ALTER TABLE contacts 
  ADD CONSTRAINT contacts_email_format_check 
  CHECK (
    email IS NULL OR 
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- Phone validation (basic format check)
ALTER TABLE contacts 
  ADD CONSTRAINT contacts_phone_format_check 
  CHECK (
    phone IS NULL OR 
    length(phone) >= 8 AND length(phone) <= 20
  );

-- Name length constraint
ALTER TABLE contacts 
  ADD CONSTRAINT contacts_name_length_check 
  CHECK (length(name) >= 2 AND length(name) <= 200);

-- 2. Create comprehensive audit log table for contact access
CREATE TABLE IF NOT EXISTS contact_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'export')),
  ip_address inet,
  user_agent text,
  accessed_fields jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE contact_access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and system can view audit logs
CREATE POLICY "Only project owners can view contact access logs"
ON contact_access_logs FOR SELECT
USING (
  auth.uid() IN (
    SELECT p.user_id 
    FROM contacts c 
    JOIN projects p ON c.project_id = p.id 
    WHERE c.id = contact_access_logs.contact_id
  )
);

-- System can insert logs
CREATE POLICY "System can insert contact access logs"
ON contact_access_logs FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contact_access_logs_contact_id 
  ON contact_access_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_access_logs_user_id 
  ON contact_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_access_logs_created_at 
  ON contact_access_logs(created_at DESC);

-- 3. Enhanced audit trigger function
CREATE OR REPLACE FUNCTION audit_contact_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the access with details
  INSERT INTO contact_access_logs (
    contact_id,
    user_id,
    action,
    accessed_fields
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
      ELSE 'view'
    END,
    CASE TG_OP
      WHEN 'UPDATE' THEN jsonb_build_object(
        'changed_fields', (
          SELECT jsonb_object_agg(key, value)
          FROM jsonb_each(to_jsonb(NEW))
          WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
        )
      )
      WHEN 'INSERT' THEN to_jsonb(NEW)
      WHEN 'DELETE' THEN to_jsonb(OLD)
      ELSE NULL
    END
  );

  -- Update access tracking
  IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
    NEW.last_accessed_at = now();
    NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    RETURN NEW;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Drop old triggers if they exist
DROP TRIGGER IF EXISTS audit_contact_changes ON contacts;
DROP TRIGGER IF EXISTS track_contact_access_trigger ON contacts;

-- Create comprehensive audit triggers
CREATE TRIGGER audit_contact_changes
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION audit_contact_access();

-- 4. Rate limiting function for contact access
CREATE OR REPLACE FUNCTION check_contact_access_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access_count integer;
BEGIN
  -- Check if user has accessed more than 100 contacts in last hour
  SELECT COUNT(*) INTO access_count
  FROM contact_access_logs
  WHERE user_id = auth.uid()
    AND created_at > now() - interval '1 hour'
    AND action = 'view';

  IF access_count > 100 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many contact accesses in the last hour';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Data sanitization function
CREATE OR REPLACE FUNCTION sanitize_contact_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trim and sanitize inputs
  NEW.name = trim(regexp_replace(NEW.name, '\s+', ' ', 'g'));
  
  IF NEW.email IS NOT NULL THEN
    NEW.email = lower(trim(NEW.email));
  END IF;
  
  IF NEW.phone IS NOT NULL THEN
    -- Remove all non-numeric characters except + and spaces
    NEW.phone = regexp_replace(NEW.phone, '[^0-9+\s()-]', '', 'g');
  END IF;
  
  -- Ensure data classification is set
  IF NEW.data_classification IS NULL THEN
    NEW.data_classification = 'personal_data';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create sanitization trigger
DROP TRIGGER IF EXISTS sanitize_contact_data_trigger ON contacts;
CREATE TRIGGER sanitize_contact_data_trigger
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_contact_data();

-- 6. Strengthen RLS policies - drop and recreate with stricter rules
DROP POLICY IF EXISTS "Project owners and admins can view contacts" ON contacts;
DROP POLICY IF EXISTS "Project owners and admins can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Project owners and admins can update contacts" ON contacts;
DROP POLICY IF EXISTS "Project owners and admins can delete contacts" ON contacts;

-- View policy with rate limiting check
CREATE POLICY "Project owners and admins can view contacts"
ON contacts FOR SELECT
USING (
  user_can_access_project_contacts_secure(project_id) AND
  auth.uid() IS NOT NULL
);

-- Insert policy with strict validation
CREATE POLICY "Project owners and admins can insert contacts"
ON contacts FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  user_can_access_project_contacts_secure(project_id) AND
  auth.uid() IS NOT NULL
);

-- Update policy
CREATE POLICY "Project owners and admins can update contacts"
ON contacts FOR UPDATE
USING (
  user_can_access_project_contacts_secure(project_id) AND
  auth.uid() IS NOT NULL
);

-- Delete policy
CREATE POLICY "Project owners and admins can delete contacts"
ON contacts FOR DELETE
USING (
  user_can_access_project_contacts_secure(project_id) AND
  auth.uid() IS NOT NULL
);

-- 7. Create function to export contact access audit report
CREATE OR REPLACE FUNCTION get_contact_access_report(
  p_project_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  contact_name text,
  total_accesses bigint,
  unique_users bigint,
  last_accessed timestamp with time zone,
  access_breakdown jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only project owners can run this report
  IF NOT EXISTS (
    SELECT 1 FROM projects 
    WHERE id = p_project_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    c.name as contact_name,
    COUNT(cal.id) as total_accesses,
    COUNT(DISTINCT cal.user_id) as unique_users,
    MAX(cal.created_at) as last_accessed,
    jsonb_object_agg(
      cal.action, 
      COUNT(cal.id)
    ) as access_breakdown
  FROM contacts c
  LEFT JOIN contact_access_logs cal ON c.id = cal.contact_id
  WHERE c.project_id = p_project_id
    AND cal.created_at > now() - (p_days || ' days')::interval
  GROUP BY c.id, c.name
  ORDER BY total_accesses DESC;
END;
$$;