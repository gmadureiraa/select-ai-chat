// Helper to create a 501 stub for unmigrated edge functions.
// Returns a Vercel handler that responds with 501 Not Implemented.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from './cors.js';

export function notImplemented(name: string) {
  return async function (req: VercelRequest, res: VercelResponse) {
    if (handlePreflight(req, res)) return;
    applyCors(res);
    res.status(501).json({
      error: 'Not Implemented',
      message: `Edge function "${name}" not yet migrated to Vercel Functions.`,
      todo: 'Port from supabase/functions/' + name + '/index.ts',
    });
  };
}
