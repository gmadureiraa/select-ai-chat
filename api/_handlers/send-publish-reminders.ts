// Migrated from supabase/functions/send-publish-reminders/index.ts
// SOMENTE cron — chama RPC global e gera reminders pra todos os workspaces.
// Trigger por user logado seria abuso (DoS na fila + spam).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && auth === `Bearer ${cronSecret}`);
  if (!isCron) {
    return jsonError(res, 403, 'Cron-only endpoint');
  }

  console.log('[send-publish-reminders] Starting...');
  await getPool().query(`SELECT create_publish_reminders()`);
  return res.status(200).json({ success: true, message: 'Publish reminders sent' });
}
