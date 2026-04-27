-- Bucket público para PNGs renderizados de carrosséis virais
INSERT INTO storage.buckets (id, name, public)
VALUES ('viral-carousel-renders', 'viral-carousel-renders', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública (necessária para Instagram/LATE puxarem as imagens)
DROP POLICY IF EXISTS "viral_carousel_renders_public_read" ON storage.objects;
CREATE POLICY "viral_carousel_renders_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'viral-carousel-renders');

-- Upload por usuários autenticados (a edge function valida o workspace)
DROP POLICY IF EXISTS "viral_carousel_renders_authenticated_insert" ON storage.objects;
CREATE POLICY "viral_carousel_renders_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'viral-carousel-renders');

-- Update por authenticated (overwrite mesmo path)
DROP POLICY IF EXISTS "viral_carousel_renders_authenticated_update" ON storage.objects;
CREATE POLICY "viral_carousel_renders_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'viral-carousel-renders');

-- Delete por authenticated (limpeza periódica)
DROP POLICY IF EXISTS "viral_carousel_renders_authenticated_delete" ON storage.objects;
CREATE POLICY "viral_carousel_renders_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'viral-carousel-renders');