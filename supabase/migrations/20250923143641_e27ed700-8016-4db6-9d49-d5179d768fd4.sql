-- Create calendar events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'task',
  color TEXT DEFAULT '#3b82f6',
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  location TEXT,
  attendees JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create calendar date blocks table
CREATE TABLE public.calendar_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  blocked_date DATE NOT NULL,
  reason TEXT,
  block_type TEXT NOT NULL DEFAULT 'unavailable',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for calendar_events
CREATE POLICY "Users can view their own calendar events"
ON public.calendar_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events"
ON public.calendar_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
ON public.calendar_events
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
ON public.calendar_events
FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for calendar_blocks
CREATE POLICY "Users can view their own calendar blocks"
ON public.calendar_blocks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar blocks"
ON public.calendar_blocks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar blocks"
ON public.calendar_blocks
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar blocks"
ON public.calendar_blocks
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX idx_calendar_events_start_datetime ON public.calendar_events(start_datetime);
CREATE INDEX idx_calendar_events_project_id ON public.calendar_events(project_id);
CREATE INDEX idx_calendar_blocks_user_id ON public.calendar_blocks(user_id);
CREATE INDEX idx_calendar_blocks_blocked_date ON public.calendar_blocks(blocked_date);

-- Create triggers for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_blocks_updated_at
  BEFORE UPDATE ON public.calendar_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();