// Migrated from supabase/functions/process-due-date-notifications/index.ts
// Cron-style endpoint that calls the SQL helper to create due-date notifications.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: vercel cron OR CRON_SECRET OR authed user
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && auth === `Bearer ${cronSecret}`);
  if (!isCron) {
    const user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Unauthorized');
  }

  try {
    console.log('[process-due-date-notifications] Starting...');
    // Mirror behaviour of original: call create_due_date_notifications() RPC.
    // Falls back gracefully if function doesn't exist in this database.
    try {
      await getPool().query('SELECT create_due_date_notifications()');
    } catch (e: any) {
      if (e.message && /does not exist|undefined function/.test(e.message)) {
        console.warn('[process-due-date-notifications] create_due_date_notifications() RPC not present, skipping.');
        return res.status(200).json({
          success: true,
          skipped: true,
          message: 'create_due_date_notifications RPC not present in database',
          timestamp: new Date().toISOString(),
        });
      }
      throw e;
    }

    return res.status(200).json({
      success: true,
      message: 'Due date notifications processed',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[process-due-date-notifications] Error:', error);
    return jsonError(res, 500, error?.message || 'Internal error');
  }
}
