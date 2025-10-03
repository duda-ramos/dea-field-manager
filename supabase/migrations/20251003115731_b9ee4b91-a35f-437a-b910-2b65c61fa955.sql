-- Add address and access notes fields to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS access_notes TEXT;