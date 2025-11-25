-- Create report_history table for storing generated reports
CREATE TABLE IF NOT EXISTS public.report_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  interlocutor TEXT NOT NULL CHECK (interlocutor IN ('cliente', 'fornecedor')),
  sections_included JSONB NOT NULL DEFAULT '{}'::jsonb,
  stats JSONB,
  file_url TEXT,
  file_size BIGINT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  generated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own report history
CREATE POLICY "Users can view their own report history"
  ON public.report_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own report history
CREATE POLICY "Users can create their own report history"
  ON public.report_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own report history
CREATE POLICY "Users can delete their own report history"
  ON public.report_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_report_history_project_id ON public.report_history(project_id);
CREATE INDEX idx_report_history_user_id ON public.report_history(user_id);
CREATE INDEX idx_report_history_generated_at ON public.report_history(generated_at DESC);

-- Add trigger to update updated_at
CREATE TRIGGER update_report_history_updated_at
  BEFORE UPDATE ON public.report_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();