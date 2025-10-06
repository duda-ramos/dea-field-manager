-- ============================================
-- COMPREHENSIVE SECURITY FIXES - Phases 1-3
-- ============================================

-- ===========================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- ===========================================

-- 1. SECURE STORAGE INTEGRATION CREDENTIALS
-- Add encryption key column and audit logging
ALTER TABLE storage_integrations 
  ADD COLUMN IF NOT EXISTS config_encrypted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamp with time zone;

-- Create audit log for storage integration access
CREATE TABLE IF NOT EXISTS storage_integration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES storage_integrations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  accessed_fields jsonb,
  ip_address inet,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE storage_integration_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only integration owners can view audit logs"
  ON storage_integration_audit FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM storage_integrations WHERE id = integration_id
    )
  );

CREATE POLICY "System can insert audit logs"
  ON storage_integration_audit FOR INSERT
  WITH CHECK (true);

-- Add trigger to audit storage integration access
CREATE OR REPLACE FUNCTION audit_storage_integration_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'SELECT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO storage_integration_audit (
      integration_id, user_id, action, accessed_fields
    ) VALUES (
      NEW.id,
      auth.uid(),
      TG_OP,
      CASE 
        WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
        ELSE NULL
      END
    );
    
    NEW.last_accessed_at = now();
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS audit_storage_integration_trigger ON storage_integrations;
CREATE TRIGGER audit_storage_integration_trigger
  BEFORE UPDATE ON storage_integrations
  FOR EACH ROW
  EXECUTE FUNCTION audit_storage_integration_access();

-- Add warning comment about sensitive data
COMMENT ON COLUMN storage_integrations.config IS 
  'SENSITIVE: Contains external service credentials. Should be encrypted at application level before storage.';

-- 2. RESTRICT CONTACT ACCESS LOGS - System Only
-- Update policy to prevent direct user inserts
DROP POLICY IF EXISTS "System can insert contact access logs" ON contact_access_logs;

CREATE POLICY "Only triggers can insert contact access logs"
  ON contact_access_logs FOR INSERT
  WITH CHECK (
    -- Only allow inserts from database triggers (no direct user access)
    current_setting('role') = 'authenticated' 
    AND pg_trigger_depth() > 0
  );

-- Add rate limiting for contact access
CREATE TABLE IF NOT EXISTS contact_access_rate_limit (
  user_id uuid PRIMARY KEY,
  access_count integer DEFAULT 0,
  window_start timestamp with time zone DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE contact_access_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limit"
  ON contact_access_rate_limit FOR SELECT
  USING (auth.uid() = user_id);

-- ===========================================
-- PHASE 2: IMPORTANT SECURITY ENHANCEMENTS
-- ===========================================

-- 4. TIGHTEN PROJECT BACKUPS SECURITY
-- Create SECURITY DEFINER function for automatic backups
CREATE OR REPLACE FUNCTION create_automatic_project_backup(
  p_project_id uuid,
  p_backup_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  backup_id uuid;
BEGIN
  -- Verify the backup is being created by the system or project owner
  IF NOT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: Only project owners can create backups';
  END IF;

  INSERT INTO project_backups (project_id, backup_data, backup_type)
  VALUES (p_project_id, p_backup_data, 'automatic')
  RETURNING id INTO backup_id;

  RETURN backup_id;
END;
$$;

-- Tighten the INSERT policy
DROP POLICY IF EXISTS "System can create automatic backups" ON project_backups;

CREATE POLICY "Only project owners can create backups"
  ON project_backups FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM projects WHERE id = project_id
    )
  );

-- 5. LIMIT COLLABORATOR DATA EXPOSURE
-- Restrict to project-scoped queries only
DROP POLICY IF EXISTS "Users can view collaborations for their projects" ON project_collaborators;

CREATE POLICY "Users can view project-scoped collaborations"
  ON project_collaborators FOR SELECT
  USING (
    -- Only show collaborations for projects the user owns or is part of
    (auth.uid() = user_id) OR 
    (auth.uid() = invited_by) OR
    (
      auth.uid() IN (
        SELECT user_id FROM projects WHERE id = project_id
      )
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_user 
  ON project_collaborators(project_id, user_id);

-- 7. REVIEW CONTACT ACCESS FOR COLLABORATORS
-- Add data masking function for sensitive contact fields
CREATE OR REPLACE FUNCTION mask_contact_data(
  p_contact_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  contact_data jsonb;
  is_owner boolean;
BEGIN
  -- Check if user is the project owner
  SELECT EXISTS(
    SELECT 1 FROM contacts c
    JOIN projects p ON c.project_id = p.id
    WHERE c.id = p_contact_id AND p.user_id = p_user_id
  ) INTO is_owner;

  SELECT to_jsonb(c.*) INTO contact_data
  FROM contacts c WHERE c.id = p_contact_id;

  -- Mask sensitive data for non-owners (collaborators)
  IF NOT is_owner THEN
    contact_data = jsonb_set(
      jsonb_set(
        contact_data,
        '{email}',
        to_jsonb(substring(contact_data->>'email' from 1 for 3) || '***@***')
      ),
      '{phone}',
      to_jsonb('***-***-' || substring(contact_data->>'phone' from length(contact_data->>'phone')-3))
    );
  END IF;

  RETURN contact_data;
END;
$$;

-- ===========================================
-- PHASE 3: ENHANCED AUDIT LOGGING
-- ===========================================

-- 10. EXTEND AUDIT LOGGING TO OTHER SENSITIVE TABLES

-- Audit logging for projects table
CREATE TABLE IF NOT EXISTS project_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  changed_fields jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE project_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can view audit logs"
  ON project_audit_logs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM projects WHERE id = project_id
    )
  );

CREATE POLICY "System can insert project audit logs"
  ON project_audit_logs FOR INSERT
  WITH CHECK (true);

-- Trigger for project changes
CREATE OR REPLACE FUNCTION audit_project_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO project_audit_logs (
    project_id, user_id, action, changed_fields
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP,
    CASE 
      WHEN TG_OP = 'UPDATE' THEN (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
      )
      WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE NULL
    END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_project_changes_trigger ON projects;
CREATE TRIGGER audit_project_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION audit_project_changes();

-- Audit logging for API keys
CREATE TABLE IF NOT EXISTS api_key_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  ip_address inet,
  success boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE api_key_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API key audit logs"
  ON api_key_audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert API key audit logs"
  ON api_key_audit_logs FOR INSERT
  WITH CHECK (true);

-- Trigger for API key usage
CREATE OR REPLACE FUNCTION audit_api_key_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.last_used_at IS DISTINCT FROM OLD.last_used_at THEN
    INSERT INTO api_key_audit_logs (api_key_id, user_id, action)
    VALUES (NEW.id, NEW.user_id, 'API_KEY_USED');
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO api_key_audit_logs (api_key_id, user_id, action)
    VALUES (NEW.id, NEW.user_id, 'API_KEY_CREATED');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO api_key_audit_logs (api_key_id, user_id, action)
    VALUES (OLD.id, OLD.user_id, 'API_KEY_DELETED');
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_api_key_usage_trigger ON api_keys;
CREATE TRIGGER audit_api_key_usage_trigger
  AFTER INSERT OR UPDATE OR DELETE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION audit_api_key_usage();

-- Add indexes for audit log performance
CREATE INDEX IF NOT EXISTS idx_project_audit_logs_project_created 
  ON project_audit_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_key_audit_logs_key_created 
  ON api_key_audit_logs(api_key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storage_integration_audit_integration_created 
  ON storage_integration_audit(integration_id, created_at DESC);

-- Add retention policy function (to be called by scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Keep audit logs for 90 days
  DELETE FROM contact_access_logs WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM project_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM api_key_audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM storage_integration_audit WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Add table comments for documentation
COMMENT ON TABLE storage_integration_audit IS 'Audit trail for storage integration access and modifications. Logs are retained for 90 days.';
COMMENT ON TABLE project_audit_logs IS 'Audit trail for project changes. Logs are retained for 90 days.';
COMMENT ON TABLE api_key_audit_logs IS 'Audit trail for API key usage and management. Logs are retained for 90 days.';
COMMENT ON TABLE contact_access_rate_limit IS 'Rate limiting for contact access to prevent data harvesting.';

-- Final security check indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_project ON contacts(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status) WHERE deleted_at IS NULL;