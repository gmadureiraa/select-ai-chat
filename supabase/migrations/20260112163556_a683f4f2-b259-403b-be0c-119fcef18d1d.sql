-- Create bucket for planning media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('planning-media', 'planning-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for planning-media bucket
-- Allow authenticated users to upload to their workspace folder
CREATE POLICY "Users can upload planning media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'planning-media' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view planning media (public bucket)
CREATE POLICY "Anyone can view planning media"
ON storage.objects FOR SELECT
USING (bucket_id = 'planning-media');

-- Allow authenticated users to update their uploads
CREATE POLICY "Users can update planning media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'planning-media' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their uploads
CREATE POLICY "Users can delete planning media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'planning-media' 
  AND auth.role() = 'authenticated'
);