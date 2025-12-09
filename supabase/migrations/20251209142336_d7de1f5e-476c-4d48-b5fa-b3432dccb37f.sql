-- Make client-files bucket private (already has RLS via storage.objects)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'client-files';

-- Add RLS policies for client-files bucket to ensure proper access control
-- Users can only access files in their clients' folders
CREATE POLICY "Users can view their client files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-files' AND
  EXISTS (
    SELECT 1 FROM clients c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
    AND c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can upload to their client folders"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-files' AND
  EXISTS (
    SELECT 1 FROM clients c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
    AND c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete their client files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-files' AND
  EXISTS (
    SELECT 1 FROM clients c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE wm.user_id = auth.uid()
    AND c.id::text = (storage.foldername(name))[1]
  )
);