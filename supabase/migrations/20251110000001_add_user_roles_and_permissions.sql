-- Add user roles and permissions system
-- This migration adds role-based access control to the application

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer', 'field_tech');

-- Add role column to profiles table
ALTER TABLE public.profiles
ADD COLUMN role user_role DEFAULT 'viewer' NOT NULL;

-- Add metadata column for additional role-specific settings
ALTER TABLE public.profiles
ADD COLUMN role_metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for role-based queries
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Create table for user invitations
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invitation_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for invitation token lookups
CREATE INDEX idx_user_invitations_token ON public.user_invitations(invitation_token);
CREATE INDEX idx_user_invitations_email ON public.user_invitations(email);

-- Enable RLS on user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage invitations
CREATE POLICY "Admins can view all invitations" ON public.user_invitations
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create invitations" ON public.user_invitations
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update invitations" ON public.user_invitations
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create table for access logs (audit trail)
CREATE TABLE public.user_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for access logs
CREATE INDEX idx_user_access_logs_user_id ON public.user_access_logs(user_id);
CREATE INDEX idx_user_access_logs_created_at ON public.user_access_logs(created_at DESC);
CREATE INDEX idx_user_access_logs_action ON public.user_access_logs(action);

-- Enable RLS on user_access_logs
ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own access logs
CREATE POLICY "Users can view their own access logs" ON public.user_access_logs
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admins can view all access logs
CREATE POLICY "Admins can view all access logs" ON public.user_access_logs
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- System can insert access logs (no user restriction)
CREATE POLICY "System can insert access logs" ON public.user_access_logs
  FOR INSERT 
  WITH CHECK (true);

-- Update trigger for user_invitations
CREATE TRIGGER update_user_invitations_updated_at 
  BEFORE UPDATE ON public.user_invitations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log user access
CREATE OR REPLACE FUNCTION log_user_access(
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.user_access_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION user_has_role(p_user_id UUID, p_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has minimum role level
-- Role hierarchy: admin > manager > field_tech > viewer
CREATE OR REPLACE FUNCTION user_has_minimum_role(p_user_id UUID, p_min_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role user_role;
  v_role_level INT;
  v_min_level INT;
BEGIN
  -- Get user's role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Convert roles to numeric levels
  v_role_level := CASE v_user_role
    WHEN 'admin' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'field_tech' THEN 2
    WHEN 'viewer' THEN 1
  END;
  
  v_min_level := CASE p_min_role
    WHEN 'admin' THEN 4
    WHEN 'manager' THEN 3
    WHEN 'field_tech' THEN 2
    WHEN 'viewer' THEN 1
  END;
  
  RETURN v_role_level >= v_min_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS user_role AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for projects to consider roles
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- Create new policies with role-based access
CREATE POLICY "Users can view their own projects or shared projects" ON public.projects
  FOR SELECT 
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.project_collaborators
      WHERE project_collaborators.project_id = projects.id
      AND project_collaborators.user_id = auth.uid()
      AND project_collaborators.status = 'accepted'
    )
  );

CREATE POLICY "Managers and admins can insert projects" ON public.projects
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    user_has_minimum_role(auth.uid(), 'manager'::user_role)
  );

CREATE POLICY "Owners, managers and admins can update projects" ON public.projects
  FOR UPDATE 
  USING (
    auth.uid() = user_id OR
    user_has_role(auth.uid(), 'admin'::user_role) OR
    (
      user_has_role(auth.uid(), 'manager'::user_role) AND
      EXISTS (
        SELECT 1 FROM public.project_collaborators
        WHERE project_collaborators.project_id = projects.id
        AND project_collaborators.user_id = auth.uid()
        AND project_collaborators.status = 'accepted'
      )
    )
  );

CREATE POLICY "Owners and admins can delete projects" ON public.projects
  FOR DELETE 
  USING (
    auth.uid() = user_id OR
    user_has_role(auth.uid(), 'admin'::user_role)
  );

-- Update RLS policies for installations to consider roles
DROP POLICY IF EXISTS "Users can view their own installations" ON public.installations;
DROP POLICY IF EXISTS "Users can insert their own installations" ON public.installations;
DROP POLICY IF EXISTS "Users can update their own installations" ON public.installations;
DROP POLICY IF EXISTS "Users can delete their own installations" ON public.installations;

CREATE POLICY "Users can view installations from their projects" ON public.installations
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = installations.project_id
      AND (
        projects.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators
          WHERE project_collaborators.project_id = projects.id
          AND project_collaborators.user_id = auth.uid()
          AND project_collaborators.status = 'accepted'
        )
      )
    )
  );

CREATE POLICY "Managers and admins can insert installations" ON public.installations
  FOR INSERT 
  WITH CHECK (
    user_has_minimum_role(auth.uid(), 'manager'::user_role) AND
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = installations.project_id
      AND (
        projects.user_id = auth.uid() OR
        user_has_role(auth.uid(), 'admin'::user_role)
      )
    )
  );

CREATE POLICY "Field techs can update installation status and photos" ON public.installations
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = installations.project_id
      AND (
        projects.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators
          WHERE project_collaborators.project_id = projects.id
          AND project_collaborators.user_id = auth.uid()
          AND project_collaborators.status = 'accepted'
        )
      )
    ) AND (
      user_has_minimum_role(auth.uid(), 'field_tech'::user_role) OR
      auth.uid() = user_id
    )
  );

CREATE POLICY "Owners, managers and admins can delete installations" ON public.installations
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = installations.project_id
      AND projects.user_id = auth.uid()
    ) OR
    user_has_role(auth.uid(), 'admin'::user_role) OR
    (
      user_has_role(auth.uid(), 'manager'::user_role) AND
      EXISTS (
        SELECT 1 FROM public.projects
        JOIN public.project_collaborators ON project_collaborators.project_id = projects.id
        WHERE projects.id = installations.project_id
        AND project_collaborators.user_id = auth.uid()
        AND project_collaborators.status = 'accepted'
      )
    )
  );

-- Set default role for existing users (admin for first user, viewer for others)
DO $$
DECLARE
  v_first_user UUID;
BEGIN
  -- Get the first user (oldest account)
  SELECT id INTO v_first_user
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Set first user as admin
  IF v_first_user IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = v_first_user;
  END IF;
  
  -- Set all other users as viewer (default)
  UPDATE public.profiles
  SET role = 'viewer'
  WHERE role IS NULL AND id != v_first_user;
END $$;

-- Comment on tables and columns
COMMENT ON TABLE public.user_invitations IS 'Stores user invitation tokens for role-based access';
COMMENT ON TABLE public.user_access_logs IS 'Audit trail for user actions and access';
COMMENT ON COLUMN public.profiles.role IS 'User role: admin (full access), manager (edit projects/installations), viewer (read-only), field_tech (mark installed + photos)';
COMMENT ON COLUMN public.profiles.role_metadata IS 'Additional role-specific settings and permissions';
