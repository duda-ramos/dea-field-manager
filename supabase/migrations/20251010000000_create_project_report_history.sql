-- Migration: Create project_report_history table and configure storage
-- Created: 2025-10-10

-- Create project_report_history table
CREATE TABLE IF NOT EXISTS project_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  interlocutor TEXT NOT NULL CHECK (interlocutor IN ('cliente', 'fornecedor')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  config JSONB DEFAULT '{}'::jsonb,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  sections_included JSONB,
  stats JSONB,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_report_history_project ON project_report_history(project_id);
CREATE INDEX idx_report_history_user ON project_report_history(user_id);
CREATE INDEX idx_report_history_generated_at ON project_report_history(generated_at DESC);

-- Enable RLS on project_report_history
ALTER TABLE project_report_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_report_history

-- Policy: Users can view their own reports
CREATE POLICY "Users can view their own reports"
  ON project_report_history
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can insert their own reports
CREATE POLICY "Users can insert their own reports"
  ON project_report_history
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own reports
CREATE POLICY "Users can delete their own reports"
  ON project_report_history
  FOR DELETE
  USING (user_id = auth.uid());

-- Create storage bucket for reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  10485760, -- 10MB in bytes
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE
SET 
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

-- Storage RLS Policies for 'reports' bucket

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload reports"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can view their own files
CREATE POLICY "Users can view their own reports"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their own reports"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_project_report_history_updated_at
  BEFORE UPDATE ON project_report_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE project_report_history IS 'Stores history of generated project reports with metadata and storage references';
COMMENT ON COLUMN project_report_history.sections_included IS 'JSON object containing which sections were included in the report (pendencias, concluidas, emRevisao, emAndamento)';
COMMENT ON COLUMN project_report_history.stats IS 'JSON object containing statistics at the time of report generation (totals, counts by section, etc)';
