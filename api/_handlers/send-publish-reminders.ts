// Migrated from supabase/functions/send-publish-reminders/index.ts
// SOMENTE cron — chama RPC global e gera reminders pra todos os workspaces.
// Trigger por user logado seria abuso (DoS na fila + spam).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool } from '../_lib/db.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  // Vercel cron envia GET; aceitar GET e POST.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  if (!assertCronAuth(req, res)) return;

  console.log('[send-publish-reminders] Starting...');
  try {
    await getPool().query(`SELECT create_publish_reminders()`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    // RPC ausente: tratar como skip pra não derrubar cron.
    if (/does not exist|undefined function/.test(message)) {
      console.warn('[send-publish-reminders] create_publish_reminders() not present, skipping');
      return res.status(200).json({ success: true, skipped: true, message });
    }
    console.error('[send-publish-reminders] error:', e);
    return jsonError(res, 500, message);
  }
  return res.status(200).json({ success: true, message: 'Publish reminders sent' });
}
