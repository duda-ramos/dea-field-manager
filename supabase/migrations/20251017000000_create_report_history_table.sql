-- Create report_history table to track generated reports
CREATE TABLE report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  interlocutor TEXT NOT NULL CHECK (interlocutor IN ('cliente', 'fornecedor')),
  file_size BIGINT,
  config JSONB,
  stats JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_report_history_project ON report_history(project_id);
CREATE INDEX idx_report_history_user ON report_history(user_id);
CREATE INDEX idx_report_history_generated_at ON report_history(generated_at DESC);

-- Enable Row Level Security
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own reports"
  ON report_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own reports"
  ON report_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reports"
  ON report_history FOR DELETE
  USING (user_id = auth.uid());
