-- Fix security vulnerability in contacts table access
-- Replace the overly permissive function with a secure one that only allows:
-- 1. Project owners
-- 2. Collaborators with admin role (not just read permissions)

-- Create secure contact access function
CREATE OR REPLACE FUNCTION public.user_can_access_project_contacts_secure(contact_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- User owns the project
    SELECT 1 FROM projects 
    WHERE id = contact_project_id AND user_id = auth.uid()
    
    UNION
    
    -- User is an accepted collaborator with admin role only
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = contact_project_id 
    AND pc.user_id = auth.uid() 
    AND pc.status = 'accepted'
    AND pc.role = 'admin'
  );
$$;

-- Create audit logging function for contact access
CREATE OR REPLACE FUNCTION public.log_contact_access(contact_id uuid, action_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log sensitive contact access for security monitoring
  INSERT INTO project_activities (project_id, user_id, action, details)
  SELECT 
    c.project_id,
    auth.uid(),
    'contact_' || action_type,
    jsonb_build_object(
      'contact_id', contact_id,
      'contact_name', c.name,
      'timestamp', now(),
      'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
    )
  FROM contacts c
  WHERE c.id = contact_id;
END;
$$;

-- Update RLS policies to use the secure function
DROP POLICY IF EXISTS "Users can view contacts for accessible projects" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts for their projects" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts for accessible projects" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts for accessible projects" ON public.contacts;

-- Create new secure policies
CREATE POLICY "Project owners and admins can view contacts"
ON public.contacts
FOR SELECT
USING (user_can_access_project_contacts_secure(project_id));

CREATE POLICY "Project owners and admins can insert contacts"
ON public.contacts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND user_can_access_project_contacts_secure(project_id)
);

CREATE POLICY "Project owners and admins can update contacts"
ON public.contacts
FOR UPDATE
USING (user_can_access_project_contacts_secure(project_id));

CREATE POLICY "Project owners and admins can delete contacts"
ON public.contacts
FOR DELETE
USING (user_can_access_project_contacts_secure(project_id));

-- Create trigger to log contact access (for SELECT operations, we'll handle in application code)
CREATE OR REPLACE FUNCTION public.audit_contact_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Log all contact modifications for security audit
  IF TG_OP = 'INSERT' THEN
    PERFORM log_contact_access(NEW.id, 'created');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_contact_access(NEW.id, 'updated');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_contact_access(OLD.id, 'deleted');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for contact audit logging
DROP TRIGGER IF EXISTS audit_contact_changes_trigger ON public.contacts;
CREATE TRIGGER audit_contact_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION audit_contact_changes();