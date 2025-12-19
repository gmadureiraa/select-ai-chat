-- Tornar o bucket client-files público para URLs permanentes
UPDATE storage.buckets 
SET public = true 
WHERE id = 'client-files';