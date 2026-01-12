-- Create storage bucket for canvas file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('canvas-files', 'canvas-files', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload canvas files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'canvas-files');

-- Allow public read access
CREATE POLICY "Public read access for canvas files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'canvas-files');

-- Allow users to delete their own files
CREATE POLICY "Users can delete own canvas files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'canvas-files');