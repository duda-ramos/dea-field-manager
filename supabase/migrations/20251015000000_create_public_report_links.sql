-- Migration: Create public_report_links table for sharing reports
-- Created: 2025-10-15

-- Create public_report_links table
CREATE TABLE IF NOT EXISTS public_report_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES project_report_history(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}' -- For future extensibility (e.g., IP restrictions, password protection)
);

-- Create indexes for performance
CREATE INDEX idx_public_links_token_hash ON public_report_links(token_hash) WHERE is_active = true;
CREATE INDEX idx_public_links_expires_at ON public_report_links(expires_at) WHERE is_active = true;
CREATE INDEX idx_public_links_report_id ON public_report_links(report_id);
CREATE INDEX idx_public_links_created_by ON public_report_links(created_by);

-- Enable RLS on public_report_links
ALTER TABLE public_report_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public_report_links

-- Policy: Users can view their own public links
CREATE POLICY "Users can view their own public links"
  ON public_report_links
  FOR SELECT
  USING (created_by = auth.uid());

-- Policy: Users can create public links for their reports
CREATE POLICY "Users can create public links for their reports"
  ON public_report_links
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM project_report_history
      WHERE id = report_id AND user_id = auth.uid()
    )
  );

-- Policy: Users can update their own public links (for revoking)
CREATE POLICY "Users can update their own public links"
  ON public_report_links
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Public access via token (for unauthenticated users)
CREATE POLICY "Public can access link data via valid token"
  ON public_report_links
  FOR SELECT
  TO anon
  USING (
    is_active = true AND
    expires_at > now() AND
    token_hash = current_setting('request.jwt.claim.token_hash', true)
  );

DROP FUNCTION IF EXISTS increment_public_link_access(UUID);

CREATE OR REPLACE FUNCTION increment_public_link_access(link_id UUID, token_hash TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.token_hash', token_hash, true);

  UPDATE public_report_links
  SET
    access_count = access_count + 1,
    last_accessed_at = now()
  WHERE
    id = link_id AND
    token_hash = current_setting('request.jwt.claim.token_hash', true) AND
    is_active = true AND
    expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function to cleanup expired links (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_public_links()
RETURNS void AS $$
BEGIN
  UPDATE public_report_links
  SET is_active = false
  WHERE 
    is_active = true AND
    expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_public_report_links_updated_at
  BEFORE UPDATE ON public_report_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

GRANT EXECUTE ON FUNCTION increment_public_link_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_public_link_access(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_public_links() TO authenticated;

-- Create view for public report access (to be used by public API)
CREATE OR REPLACE VIEW public_report_access AS
SELECT 
  pl.id as link_id,
  pl.token_hash,
  pl.expires_at,
  pl.access_count,
  prh.id as report_id,
  prh.project_id,
  prh.file_url,
  prh.file_name,
  prh.format,
  prh.interlocutor,
  prh.generated_at,
  prh.sections_included,
  prh.stats
FROM 
  public_report_links pl
  INNER JOIN project_report_history prh ON pl.report_id = prh.id
WHERE 
  pl.is_active = true AND
  pl.expires_at > now();

-- Grant select on view to anon for public access
GRANT SELECT ON public_report_access TO anon;

-- Secure function to fetch public report access by token hash
CREATE OR REPLACE FUNCTION get_public_report_access(token_hash TEXT)
RETURNS TABLE (
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
) AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.token_hash', token_hash, true);

  RETURN QUERY
  SELECT
    pl.id,
    pl.token_hash,
    pl.expires_at,
    pl.access_count,
    prh.id,
    prh.project_id,
    prh.file_url,
    prh.file_name,
    prh.format,
    prh.interlocutor,
    prh.generated_at,
    prh.sections_included,
    prh.stats
  FROM
    public_report_links pl
    INNER JOIN project_report_history prh ON pl.report_id = prh.id
  WHERE
    pl.token_hash = current_setting('request.jwt.claim.token_hash', true) AND
    pl.is_active = true AND
    pl.expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION get_public_report_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_public_report_access(TEXT) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public_report_links IS 'Stores public sharing links for project reports with expiration and access tracking';
COMMENT ON COLUMN public_report_links.token_hash IS 'SHA-256 hash of the public access token';
COMMENT ON COLUMN public_report_links.expires_at IS 'Timestamp when the public link expires';
COMMENT ON COLUMN public_report_links.is_active IS 'Whether the link is currently active (can be manually revoked)';
COMMENT ON COLUMN public_report_links.access_count IS 'Number of times the public link has been accessed';
COMMENT ON COLUMN public_report_links.metadata IS 'JSON object for future extensibility (IP restrictions, password protection, etc)';
COMMENT ON VIEW public_report_access IS 'View for public report access via tokens, joins link data with report data';