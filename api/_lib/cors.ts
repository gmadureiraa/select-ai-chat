// Standard CORS headers + helper for Vercel Functions.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function applyCors(res: VercelResponse) {
  for (const [k, v] of Object.entries(corsHeaders)) {
    res.setHeader(k, v);
  }
}

/**
 * Handle OPTIONS preflight. Returns true if request was handled (caller should return).
 */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function jsonError(res: VercelResponse, status: number, message: string, extra?: Record<string, any>) {
  applyCors(res);
  res.status(status).json({ error: message, ...(extra || {}) });
}
