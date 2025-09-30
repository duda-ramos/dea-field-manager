-- Add fields for project lifecycle management
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS permanent_deletion_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON projects(archived_at) WHERE archived_at IS NOT NULL;

-- Function to permanently delete old projects (7 days in trash)
CREATE OR REPLACE FUNCTION delete_old_trashed_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permanently delete projects that have been in trash for more than 7 days
  DELETE FROM projects 
  WHERE deleted_at IS NOT NULL 
  AND deleted_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Function to auto-delete old archived projects (6 months)
CREATE OR REPLACE FUNCTION delete_old_archived_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permanently delete archived projects older than 6 months
  DELETE FROM projects 
  WHERE archived_at IS NOT NULL 
  AND archived_at < NOW() - INTERVAL '6 months';
END;
$$;

-- Update RLS policies to handle deleted and archived projects
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
CREATE POLICY "Users can view their own projects"
ON projects
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to update their projects (including soft delete and archive)
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
CREATE POLICY "Users can update their own projects"
ON projects
FOR UPDATE
USING (auth.uid() = user_id);

-- Comment: These functions should be called periodically via cron jobs
-- For now, they can be called manually or via edge functions