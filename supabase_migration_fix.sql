-- ═══════════════════════════════════════════════════════════
-- SCRIPT DE CORREÇÃO: Sistema de envio de email travado
-- Execute estas queries no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════

-- PASSO 1: Verificar se bucket 'reports' existe
SELECT * FROM storage.buckets WHERE id = 'reports';

-- Se o resultado acima for VAZIO, execute este INSERT:
/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  10485760,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);
*/

-- PASSO 2: Verificar se tabela project_report_history existe
SELECT * FROM project_report_history LIMIT 1;

-- Se der erro "relation does not exist", execute a migration completa abaixo:
/*
-- Create project_report_history table
CREATE TABLE IF NOT EXISTS project_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  interlocutor TEXT NOT NULL CHECK (interlocutor IN ('cliente', 'fornecedor')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
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
CREATE POLICY "Users can view their own reports"
  ON project_report_history
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own reports"
  ON project_report_history
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reports"
  ON project_report_history
  FOR DELETE
  USING (user_id = auth.uid());

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
*/

-- PASSO 3: Verificar políticas de Storage
SELECT * FROM storage.policies WHERE bucket_id = 'reports';

-- Se não retornar pelo menos 3 políticas, execute:
/*
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
*/

-- PASSO 4: Verificar se há registros na tabela (opcional)
-- SELECT COUNT(*) FROM project_report_history;

-- ═══════════════════════════════════════════════════════════
-- IMPORTANTE: 
-- 1. Execute cada verificação separadamente
-- 2. Descomente e execute apenas os INSERTs/CREATEs necessários
-- 3. Confirme cada operação antes de prosseguir
-- ═══════════════════════════════════════════════════════════