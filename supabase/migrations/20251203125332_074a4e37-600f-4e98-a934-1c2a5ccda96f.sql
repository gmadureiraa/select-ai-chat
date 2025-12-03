-- Create storage bucket for social media images
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-images', 'social-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload social images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'social-images' AND auth.uid() IS NOT NULL);

-- Allow public read access for social images
CREATE POLICY "Public can view social images"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own social images"
ON storage.objects FOR DELETE
USING (bucket_id = 'social-images' AND auth.uid() IS NOT NULL);