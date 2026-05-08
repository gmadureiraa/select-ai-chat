// Migrated from supabase/functions/extract-knowledge/index.ts
// Reads files from Vercel Blob (replaces Supabase Storage 'client-files' bucket).
// Falls back to direct fetch if a full URL is given.
import { authedPost } from '../_lib/handler.js';
import { head } from '@vercel/blob';

export default authedPost(async ({ body }) => {
  const { clientFolder, files } = body;
  if (!clientFolder || !Array.isArray(files)) throw new Error('clientFolder e files são obrigatórios');

  const contents: Array<{ file: string; content: string } | null> = await Promise.all(
    files.map(async (file: string) => {
      try {
        // If file is a full URL, fetch directly
        if (/^https?:\/\//i.test(file)) {
          const r = await fetch(file);
          if (!r.ok) return null;
          return { file, content: await r.text() };
        }
        // Otherwise resolve via Vercel Blob (head returns the public URL)
        const blobPath = `${clientFolder}/${file}`;
        const meta = await head(blobPath, { token: process.env.BLOB_READ_WRITE_TOKEN });
        const r = await fetch(meta.url);
        if (!r.ok) return null;
        return { file, content: await r.text() };
      } catch (err) {
        console.warn(`[extract-knowledge] Failed to load ${file}:`, err);
        return null;
      }
    })
  );

  const validContents = contents.filter(Boolean);
  return { contents: validContents, loaded: validContents.length, total: files.length };
});
