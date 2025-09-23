-- Modify budgets table to support file management instead of financial amounts
ALTER TABLE public.budgets 
DROP COLUMN amount;

-- Add file-related columns
ALTER TABLE public.budgets 
ADD COLUMN file_name TEXT,
ADD COLUMN file_path TEXT,
ADD COLUMN file_size BIGINT,
ADD COLUMN uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Rename table to better reflect its purpose as supplier management
ALTER TABLE public.budgets RENAME TO supplier_proposals;

-- Create storage policies for the Orcamentos bucket
CREATE POLICY "Users can upload their own proposal files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'Orcamentos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own proposal files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'Orcamentos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own proposal files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'Orcamentos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own proposal files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'Orcamentos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);