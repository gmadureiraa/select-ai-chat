// Adapter SV: /api/upload → Vercel Blob direto.
// SV envia FormData multipart com campo "file". Devolve { url, path }.
//
// 2026-05-18 — Fix bug Gabriel: imagem subia mas vinha quebrada porque o
// handler antigo lia req inteiro como bytes raw (incluindo boundary + headers
// MIME do multipart) e salvava no Blob com content-type "multipart/form-data".
// Browser não renderizava (formato inválido). Agora parseia o multipart de
// verdade via Web API Request.formData() — extrai só o binary do field "file"
// + content-type real do arquivo.
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

  // Lê body raw em memória pra alimentar o Web Request
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) return jsonError(res, 400, 'Empty body');
  if (buffer.length > 20 * 1024 * 1024) return jsonError(res, 413, 'File too large (>20MB)');

  // Web Request pra parsear multipart corretamente. Header content-type
  // precisa preservar o `boundary=...` que o browser setou.
  const contentTypeHeader = req.headers['content-type'] ?? 'application/octet-stream';
  const isMultipart = contentTypeHeader.includes('multipart/form-data');

  let fileBuffer: Buffer;
  let fileContentType: string;
  let fileName: string;

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
    } catch (err: any) {
      console.error('[upload] multipart parse failed:', err);
      return jsonError(res, 400, `Multipart inválido: ${err?.message ?? err}`);
    }
  } else {
    // Fallback raw body (compat com uploads que mandam binary direto)
    fileBuffer = buffer;
    fileContentType = contentTypeHeader.split(';')[0]?.trim() || 'application/octet-stream';
    fileName =
      (req.query.filename as string) ||
      `upload-${Date.now()}.${fileContentType.split('/')[1] ?? 'bin'}`;
  }

  // Sanity check — content-type tem que ser image/* ou video/*
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

  // Path: prefix por user pra isolamento
  const blobPath = `client-files/uploads/${auth.id}/${fileName}`;

  try {
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      contentType: fileContentType,
      addRandomSuffix: true,
      token: blobToken,
    });
    return res.status(200).json({
      url: blob.url,
      path: blob.pathname,
      size: fileBuffer.length,
      contentType: fileContentType,
    });
  } catch (err: any) {
    console.error('[upload] failed:', err);
    return jsonError(res, 500, err?.message ?? 'Upload failed');
  }
}
