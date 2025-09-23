-- Add installation time estimate field to projects table
ALTER TABLE public.projects 
ADD COLUMN installation_time_estimate_days INTEGER;

-- Add comment to clarify the field purpose
COMMENT ON COLUMN public.projects.installation_time_estimate_days IS 'Estimativa de tempo de instalação em dias úteis';