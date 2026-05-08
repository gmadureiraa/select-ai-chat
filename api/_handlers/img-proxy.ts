// Adapter SV: /api/img-proxy → reusa radar-img-proxy.
// SV chama com `?url=...` em todas as renderizações de slide pra hot-link IG.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import radarImgProxy from './radar-img-proxy.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return (radarImgProxy as any)(req, res);
}
