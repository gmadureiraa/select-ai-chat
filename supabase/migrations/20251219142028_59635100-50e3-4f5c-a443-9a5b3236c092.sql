-- Create storage bucket for reference PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-pdfs', 'reference-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for reference-pdfs bucket
CREATE POLICY "Authenticated users can upload reference PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reference-pdfs');

CREATE POLICY "Authenticated users can view reference PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'reference-pdfs');

CREATE POLICY "Authenticated users can delete their reference PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reference-pdfs');