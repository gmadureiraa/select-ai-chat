-- Create content-media bucket for canvas file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('content-media', 'content-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Policy for authenticated users to upload files
CREATE POLICY "Users can upload to content-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-media');

-- Policy for public read access
CREATE POLICY "Public read access for content-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'content-media');

-- Policy for authenticated users to delete their files
CREATE POLICY "Users can delete from content-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'content-media');