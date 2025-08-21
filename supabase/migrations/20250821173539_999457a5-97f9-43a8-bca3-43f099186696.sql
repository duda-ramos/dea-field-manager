-- Fix function search path security warning by recreating triggers
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
DROP TRIGGER IF EXISTS update_installations_updated_at ON public.installations;
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON public.budgets;
DROP TRIGGER IF EXISTS update_item_versions_updated_at ON public.item_versions;
DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Create secure function with proper search path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installations_updated_at BEFORE UPDATE ON public.installations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_versions_updated_at BEFORE UPDATE ON public.item_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();