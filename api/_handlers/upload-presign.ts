// POST /api/upload-presign — gera URL PUT assinada para upload direto no R2.
//
// Mantém a semântica "bucket" do antigo supabase.storage como prefixo da key:
// bucket=planning-media + path=planning/<client>/<file> vira
// planning-media/planning/<client>/<suffix>-<file>.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { presignPut, sanitizeKey } from '../_lib/r2.js';

const MAX_DIRECT_UPLOAD_BYTES = 250 * 1024 * 1024;
const ALLOWED_BUCKET = /^[a-zA-Z0-9._-]{1,80}$/;

const BodySchema = z.object({
  bucket: z.string().min(1).max(80),
  path: z.string().min(1).max(600),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(3).max(120),
  size: z.number().int().min(1).max(MAX_DIRECT_UPLOAD_BYTES),
});

function cleanPath(path: string): string {
  const parts = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .map((part) => sanitizeKey(part));
  return parts.join('/');
}

function dirname(path: string): string {
  const clean = cleanPath(path);
  const parts = clean.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function requestBody(req: VercelRequest): unknown {
  if (typeof req.body !== 'string') return req.body ?? {};
  try {
    return JSON.parse(req.body) as unknown;
  } catch {
    return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed', {}, req);

  const auth = await tryAuth(req).catch(() => null);
  if (!auth) return jsonError(res, 401, 'Authentication required', {}, req);

  const parsed = BodySchema.safeParse(requestBody(req));
  if (!parsed.success) {
    return jsonError(
      res,
      400,
      parsed.error.errors.map((e) => e.message).join('; '),
      {},
      req,
    );
  }

  const { bucket, path, fileName, contentType, size } = parsed.data;
  if (!ALLOWED_BUCKET.test(bucket)) {
    return jsonError(res, 400, 'Bucket inválido', {}, req);
  }
  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return jsonError(
      res,
      400,
      `Tipo inválido: ${contentType}. Aceita só image/* ou video/*.`,
      {},
      req,
    );
  }

  const cleanFileName = sanitizeKey(fileName);
  const prefix = dirname(path) || `uploads/${auth.id}`;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = cleanPath(`${bucket}/${prefix}/${suffix}-${cleanFileName}`);
  const bucketPrefix = `${bucket}/`;

  try {
    const signed = await presignPut(key, contentType);
    const publicPath = signed.key.startsWith(bucketPrefix)
      ? signed.key.slice(bucketPrefix.length)
      : signed.key;

    return res.status(200).json({
      uploadUrl: signed.uploadUrl,
      publicUrl: signed.publicUrl,
      key: signed.key,
      path: publicPath,
      size,
      contentType,
      expiresIn: signed.expiresIn,
      headers: signed.headers,
    });
  } catch (err: unknown) {
    console.error('[upload-presign] failed:', err);
    return jsonError(
      res,
      500,
      err instanceof Error ? err.message : 'Failed to presign upload',
      {},
      req,
    );
  }
}
