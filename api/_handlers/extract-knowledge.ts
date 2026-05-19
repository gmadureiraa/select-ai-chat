// Lê arquivos do R2 (substituto de Vercel Blob desde 2026-05-19) ou de URL
// pública direta se já vier full URL.
import { authedPost } from '../_lib/handler.js';

export default authedPost(async ({ body }) => {
  const { clientFolder, files } = body;
  if (!clientFolder || !Array.isArray(files)) throw new Error('clientFolder e files são obrigatórios');

  const publicBase = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

  const contents: Array<{ file: string; content: string } | null> = await Promise.all(
    files.map(async (file: string) => {
      try {
        if (/^https?:\/\//i.test(file)) {
          const r = await fetch(file);
          if (!r.ok) return null;
          return { file, content: await r.text() };
        }
        // Resolve via R2 public URL
        if (!publicBase) {
          console.warn('[extract-knowledge] R2_PUBLIC_URL ausente; skip', file);
          return null;
        }
        const url = `${publicBase}/${clientFolder}/${file}`;
        const r = await fetch(url);
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
