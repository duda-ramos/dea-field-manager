-- Configure reports storage bucket and RLS policies

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('reports', 'reports', false, 10485760) -- 10MB limit
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own reports" ON storage.objects;

-- Create RLS policies for reports bucket

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload own reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can read their own files
CREATE POLICY "Users can read own reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reports' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );
