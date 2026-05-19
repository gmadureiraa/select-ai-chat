// /api/upload — endpoint DEDICADO (fora do router) pra preservar body raw
// multipart. O router catch-all (api/router.ts) deixa o Vercel parsear o body
// antes do handler rodar, então `for await (chunk of req)` lê 0 bytes nele.
// Aqui setamos config.bodyParser=false explicitamente.
//
// 2026-05-19 — Migração Vercel Blob → Cloudflare R2 (Blob suspenso por estourar
// quota 100MB free). R2 oferece 10GB free + zero egress.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from './_lib/cors.js';
import { tryAuth } from './_lib/auth.js';
import { putObject, sanitizeKey } from './_lib/r2.js';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required');

  if (!process.env.R2_BUCKET || !process.env.R2_PUBLIC_URL) {
    return jsonError(res, 503, 'Storage não configurado (R2 env vars ausentes)');
  }

  // Body raw em memória pra alimentar o Web Request multipart parser.
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) return jsonError(res, 400, 'Empty body');
  if (buffer.length > 20 * 1024 * 1024) return jsonError(res, 413, 'File too large (>20MB)');

  const contentTypeHeader = req.headers['content-type'] ?? 'application/octet-stream';
  const isMultipart = contentTypeHeader.includes('multipart/form-data');

  let fileBuffer: Buffer;
  let fileContentType: string;
  let fileName: string;
  let pathPrefix: string | undefined;

  if (isMultipart) {
    try {
      const webReq = new Request('http://localhost/upload', {
        method: 'POST',
        headers: { 'content-type': contentTypeHeader },
        body: buffer,
      });
      const form = await webReq.formData();
      const fileField = form.get('file') as Blob | null;
      if (!fileField || typeof (fileField as Blob).arrayBuffer !== 'function') {
        return jsonError(res, 400, 'Campo "file" ausente no multipart');
      }
      const arr = new Uint8Array(await fileField.arrayBuffer());
      fileBuffer = Buffer.from(arr);
      fileContentType = (fileField as any).type || 'application/octet-stream';
      fileName =
        (fileField as any).name ||
        (req.query.filename as string) ||
        `upload-${Date.now()}`;
      const pathField = form.get('path');
      if (typeof pathField === 'string' && pathField.trim()) {
        pathPrefix = pathField.trim();
      }
    } catch (err: any) {
      console.error('[upload] multipart parse failed:', err);
      return jsonError(res, 400, `Multipart inválido: ${err?.message ?? err}`);
    }
  } else {
    fileBuffer = buffer;
    fileContentType = contentTypeHeader.split(';')[0]?.trim() || 'application/octet-stream';
    fileName =
      (req.query.filename as string) ||
      `upload-${Date.now()}.${fileContentType.split('/')[1] ?? 'bin'}`;
    if (typeof req.query.path === 'string') pathPrefix = req.query.path;
  }

  if (
    !fileContentType.startsWith('image/') &&
    !fileContentType.startsWith('video/')
  ) {
    return jsonError(
      res,
      400,
      `Tipo inválido: ${fileContentType}. Aceita só image/* ou video/*.`,
    );
  }

  const cleanFileName = sanitizeKey(fileName);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = pathPrefix
    ? `${pathPrefix.replace(/^\/+|\/+$/g, '')}/${suffix}-${cleanFileName}`
    : `client-files/uploads/${auth.id}/${suffix}-${cleanFileName}`;

  try {
    const r = await putObject(key, fileBuffer, fileContentType);
    return res.status(200).json({
      url: r.url,
      path: r.key,
      size: r.size,
      contentType: fileContentType,
    });
  } catch (err: any) {
    console.error('[upload] R2 put failed:', err);
    return jsonError(res, 500, err?.message ?? 'Upload failed');
  }
}
