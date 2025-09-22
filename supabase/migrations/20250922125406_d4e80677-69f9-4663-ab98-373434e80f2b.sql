-- Create project_versions table for version control
CREATE TABLE public.project_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  size_bytes BIGINT
);

-- Enable RLS
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view versions of their projects" 
ON public.project_versions 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT projects.user_id FROM projects WHERE projects.id = project_versions.project_id
  UNION
  SELECT project_collaborators.user_id FROM project_collaborators 
  WHERE project_collaborators.project_id = project_versions.project_id 
  AND project_collaborators.status = 'accepted'
));

CREATE POLICY "Users can create versions of their projects" 
ON public.project_versions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.uid() IN (
  SELECT projects.user_id FROM projects WHERE projects.id = project_versions.project_id
  UNION
  SELECT project_collaborators.user_id FROM project_collaborators 
  WHERE project_collaborators.project_id = project_versions.project_id 
  AND project_collaborators.status = 'accepted'
  AND (project_collaborators.permissions->>'write')::boolean = true
));

-- Create project_backups table for automatic backup system
CREATE TABLE public.project_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  backup_type TEXT NOT NULL DEFAULT 'automatic',
  backup_data JSONB NOT NULL,
  file_count INTEGER,
  total_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  restore_point BOOLEAN DEFAULT false
);

-- Enable RLS  
ALTER TABLE public.project_backups ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view backups of their projects" 
ON public.project_backups 
FOR SELECT 
USING (auth.uid() IN (
  SELECT projects.user_id FROM projects WHERE projects.id = project_backups.project_id
  UNION
  SELECT project_collaborators.user_id FROM project_collaborators 
  WHERE project_collaborators.project_id = project_backups.project_id 
  AND project_collaborators.status = 'accepted'
));

CREATE POLICY "System can create automatic backups" 
ON public.project_backups 
FOR INSERT 
WITH CHECK (backup_type = 'automatic' OR auth.uid() IN (
  SELECT projects.user_id FROM projects WHERE projects.id = project_backups.project_id
));

-- Create real-time collaboration events table
CREATE TABLE public.collaboration_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collaboration_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Project collaborators can view events" 
ON public.collaboration_events 
FOR SELECT 
USING (auth.uid() IN (
  SELECT projects.user_id FROM projects WHERE projects.id = collaboration_events.project_id
  UNION
  SELECT project_collaborators.user_id FROM project_collaborators 
  WHERE project_collaborators.project_id = collaboration_events.project_id 
  AND project_collaborators.status = 'accepted'
));

CREATE POLICY "Project collaborators can create events" 
ON public.collaboration_events 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.uid() IN (
  SELECT projects.user_id FROM projects WHERE projects.id = collaboration_events.project_id
  UNION
  SELECT project_collaborators.user_id FROM project_collaborators 
  WHERE project_collaborators.project_id = collaboration_events.project_id 
  AND project_collaborators.status = 'accepted'
));

-- Enable realtime for collaboration events
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaboration_events;

-- Create function to auto-create backups
CREATE OR REPLACE FUNCTION public.create_automatic_backup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create backup every 10 changes or daily
  IF (SELECT COUNT(*) FROM project_backups WHERE project_id = NEW.id) = 0 
     OR (SELECT COUNT(*) FROM collaboration_events WHERE project_id = NEW.id AND created_at > (
         SELECT MAX(created_at) FROM project_backups WHERE project_id = NEW.id
       )) >= 10 THEN
    
    INSERT INTO project_backups (project_id, backup_data, backup_type)
    VALUES (NEW.id, row_to_json(NEW), 'automatic');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic backups
CREATE TRIGGER create_backup_on_project_update
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_automatic_backup();