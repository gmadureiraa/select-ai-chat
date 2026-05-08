// Adapter SV: /api/upload → Vercel Blob direto.
// SV envia FormData com arquivo. Devolve { url, path }.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return jsonError(res, 503, 'Storage not configured');

  // Lê body raw (multipart ou raw bytes)
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  if (buffer.length === 0) return jsonError(res, 400, 'Empty body');
  if (buffer.length > 10 * 1024 * 1024) return jsonError(res, 413, 'File too large (>10MB)');

  // Detecta content-type pelo header
  const contentType =
    (req.headers['content-type']?.split(';')[0]?.trim() as string) ||
    'application/octet-stream';

  // Path: prefix por user pra isolamento
  const filename =
    (req.query.filename as string) ||
    `upload-${Date.now()}.${contentType.split('/')[1]?.split(';')[0] ?? 'bin'}`;
  const blobPath = `client-files/uploads/${auth.id}/${filename}`;

  try {
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      token: blobToken,
    });
    return res.status(200).json({
      url: blob.url,
      path: blob.pathname,
      size: buffer.length,
      contentType,
    });
  } catch (err: any) {
    console.error('[upload] failed:', err);
    return jsonError(res, 500, err?.message ?? 'Upload failed');
  }
}
