-- Create public_report_links table for shareable report links
CREATE TABLE IF NOT EXISTS public.public_report_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Create public_report_access table for tracking access to public reports
CREATE TABLE IF NOT EXISTS public.public_report_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.public_report_links(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  report_id UUID,
  project_id UUID,
  file_url TEXT,
  file_name TEXT,
  format TEXT CHECK (format IN ('pdf', 'xlsx')),
  interlocutor TEXT CHECK (interlocutor IN ('cliente', 'fornecedor')),
  generated_at TIMESTAMP WITH TIME ZONE,
  sections_included JSONB,
  stats JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.public_report_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_report_access ENABLE ROW LEVEL SECURITY;

-- Public report links policies
CREATE POLICY "Users can view their own report links"
  ON public.public_report_links
  FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own report links"
  ON public.public_report_links
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own report links"
  ON public.public_report_links
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own report links"
  ON public.public_report_links
  FOR DELETE
  USING (auth.uid() = created_by);

-- Public report access - these can be accessed without auth via token
CREATE POLICY "Public report access is viewable by anyone"
  ON public.public_report_access
  FOR SELECT
  USING (true);

-- Create indexes
CREATE INDEX idx_public_report_links_token_hash ON public.public_report_links(token_hash);
CREATE INDEX idx_public_report_links_created_by ON public.public_report_links(created_by);
CREATE INDEX idx_public_report_access_link_id ON public.public_report_access(link_id);
CREATE INDEX idx_public_report_access_token_hash ON public.public_report_access(token_hash);

-- Create functions for public report access
CREATE OR REPLACE FUNCTION public.get_public_report_access(p_token_hash TEXT)
RETURNS TABLE(
  link_id UUID,
  token_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER,
  report_id UUID,
  project_id UUID,
  file_url TEXT,
  file_name TEXT,
  format TEXT,
  interlocutor TEXT,
  generated_at TIMESTAMP WITH TIME ZONE,
  sections_included JSONB,
  stats JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pra.link_id,
    pra.token_hash,
    pra.expires_at,
    pra.access_count,
    pra.report_id,
    pra.project_id,
    pra.file_url,
    pra.file_name,
    pra.format,
    pra.interlocutor,
    pra.generated_at,
    pra.sections_included,
    pra.stats
  FROM public.public_report_access pra
  WHERE pra.token_hash = p_token_hash
    AND pra.expires_at > NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_public_link_access(p_link_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.public_report_links
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = p_link_id;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_public_report_links_updated_at
  BEFORE UPDATE ON public.public_report_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_public_report_access_updated_at
  BEFORE UPDATE ON public.public_report_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();