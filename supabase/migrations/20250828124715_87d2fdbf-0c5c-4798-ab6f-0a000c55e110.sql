-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- Create RLS policies for project files bucket
CREATE POLICY "Users can view their own project files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own project files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own project files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own project files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create project_files table to track file metadata
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  category TEXT DEFAULT 'general', -- general, photos, documents, drawings
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Create policies for project_files table
CREATE POLICY "Users can view their own project files" 
ON public.project_files 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project files" 
ON public.project_files 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project files" 
ON public.project_files 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project files" 
ON public.project_files 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_project_files_updated_at
BEFORE UPDATE ON public.project_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();