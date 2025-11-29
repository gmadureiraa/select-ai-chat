-- Make client-files bucket public for template references
UPDATE storage.buckets 
SET public = true 
WHERE id = 'client-files';

-- Update RLS policy for public read access to files
DROP POLICY IF EXISTS "Public read access for client files" ON storage.objects;

CREATE POLICY "Public read access for client files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'client-files');

-- Keep write policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can upload client files" ON storage.objects;

CREATE POLICY "Authenticated users can upload client files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-files' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Authenticated users can update their client files" ON storage.objects;

CREATE POLICY "Authenticated users can update their client files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'client-files' 
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Authenticated users can delete their client files" ON storage.objects;

CREATE POLICY "Authenticated users can delete their client files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'client-files' 
  AND auth.uid() IS NOT NULL
);