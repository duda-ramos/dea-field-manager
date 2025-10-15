-- Create email_logs table for tracking email sends
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  report_id UUID NOT NULL REFERENCES public.project_report_history(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX idx_email_logs_report_id ON public.email_logs(report_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX idx_email_logs_recipient_email ON public.email_logs(recipient_email);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own email logs
CREATE POLICY "Users can view own email logs" ON public.email_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own email logs (through edge function)
CREATE POLICY "Users can insert own email logs" ON public.email_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add comment to table
COMMENT ON TABLE public.email_logs IS 'Tracks email sends for reports with rate limiting and audit purposes';
COMMENT ON COLUMN public.email_logs.user_id IS 'User who sent the email';
COMMENT ON COLUMN public.email_logs.recipient_email IS 'Email address of the recipient';
COMMENT ON COLUMN public.email_logs.report_id IS 'Report that was sent';
COMMENT ON COLUMN public.email_logs.sent_at IS 'When the email was sent';
COMMENT ON COLUMN public.email_logs.success IS 'Whether the email was sent successfully';
COMMENT ON COLUMN public.email_logs.error_message IS 'Error message if sending failed';