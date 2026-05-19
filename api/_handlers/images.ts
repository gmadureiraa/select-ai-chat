// Adapter SV: /api/images → busca/gera imagens pra slides do carrossel.
// SV envia { mode: 'search' | 'generate', query|prompt, ...}.
// Mapeia pros handlers existentes:
//   - mode='search'   → image-search (Pexels/Unsplash)
//   - mode='generate' → generate-image (Imagen)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import imageSearch from './image-search.js';
import generateImage from './generate-image.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const body = (req.body ?? {}) as Record<string, any>;
  const mode = body.mode === 'generate' ? 'generate' : 'search';
  const downstream = mode === 'generate' ? generateImage : imageSearch;
  return (downstream as any)(req, res);
}
