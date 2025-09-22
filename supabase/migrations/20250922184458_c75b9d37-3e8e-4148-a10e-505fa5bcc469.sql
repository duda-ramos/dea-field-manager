-- Create security definer function to check project ownership
CREATE OR REPLACE FUNCTION public.user_can_access_project_contacts(contact_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User owns the project
    SELECT 1 FROM projects 
    WHERE id = contact_project_id AND user_id = auth.uid()
    
    UNION
    
    -- User is an accepted collaborator with read permissions on the project
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = contact_project_id 
    AND pc.user_id = auth.uid() 
    AND pc.status = 'accepted'
    AND (pc.permissions->>'read')::boolean = true
  );
$$;

-- Drop existing RLS policies for contacts
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;  
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;

-- Create new RLS policies based on project access
CREATE POLICY "Users can view contacts for accessible projects" 
ON public.contacts 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  public.user_can_access_project_contacts(project_id)
);

CREATE POLICY "Users can insert contacts for their projects" 
ON public.contacts 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  public.user_can_access_project_contacts(project_id)
);

CREATE POLICY "Users can update contacts for accessible projects" 
ON public.contacts 
FOR UPDATE 
USING (
  auth.uid() = user_id OR
  public.user_can_access_project_contacts(project_id)
);

CREATE POLICY "Users can delete contacts for accessible projects" 
ON public.contacts 
FOR DELETE 
USING (
  auth.uid() = user_id OR
  public.user_can_access_project_contacts(project_id)
);