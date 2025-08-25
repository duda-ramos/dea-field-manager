-- Add data classification and audit fields to contacts table
ALTER TABLE public.contacts 
ADD COLUMN data_classification text DEFAULT 'personal_data',
ADD COLUMN last_accessed_at timestamp with time zone DEFAULT now(),
ADD COLUMN access_count integer DEFAULT 0;

-- Create index for audit queries
CREATE INDEX idx_contacts_last_accessed ON public.contacts(last_accessed_at);
CREATE INDEX idx_contacts_data_classification ON public.contacts(data_classification);

-- Add comments for data classification
COMMENT ON COLUMN public.contacts.data_classification IS 'Classification of data type: personal_data, business_contact, etc.';
COMMENT ON COLUMN public.contacts.last_accessed_at IS 'Timestamp of last access for audit purposes';
COMMENT ON COLUMN public.contacts.access_count IS 'Number of times this contact has been accessed';

-- Create function to update access tracking
CREATE OR REPLACE FUNCTION public.track_contact_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only track SELECT operations on contacts table
  IF TG_OP = 'SELECT' THEN
    -- Update access tracking (this won't work for SELECT triggers)
    -- Instead, we'll track this in application code
    RETURN NULL;
  END IF;
  RETURN NULL;
END;
$function$;