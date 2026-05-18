// Stub mantido pra retrocompat com dev-test-flows.ts (dev-only).
// Reels Viral foi removido do KAI 2026-05-16 (virou app separado em
// reels.kaleidos.com.br). NÃO está registrado no handler-manifest —
// só é importado dinamicamente pelo dev-test-flows pra smoke test.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(501).json({
    error: 'adapt-viral-reel: feature removida do KAI 2026-05-16. Reels Viral é app separado.',
  });
}
