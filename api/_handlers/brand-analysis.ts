// Adapter SV: /api/brand-analysis → generate-client-context.
// Onboarding/settings SV chama pra extrair niche/tone/persona via IA.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import generateClientContext from './generate-client-context.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return (generateClientContext as any)(req, res);
}
