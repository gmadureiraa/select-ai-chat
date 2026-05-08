// Adapter: /api/transcribe-video → transcribe-media (handler real).
// UnifiedUploader chama transcribe-video pra extrair texto de mp4 upload.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import transcribeMedia from './transcribe-media.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return (transcribeMedia as any)(req, res);
}
