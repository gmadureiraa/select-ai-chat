// Migrated from supabase/functions/process-due-date-notifications/index.ts
// Cron-style endpoint that calls the SQL helper to create due-date notifications.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: SOMENTE cron — opera global em todos os workspaces.
  if (!assertCronAuth(req, res)) return;

  try {
    console.log('[process-due-date-notifications] Starting...');
    const pool = getPool();
    const ran: string[] = [];
    const skipped: string[] = [];

    // 1. Planning items (legado) — RPC create_due_date_notifications()
    try {
      await pool.query('SELECT create_due_date_notifications()');
      ran.push('planning_items');
    } catch (e: any) {
      if (e?.message && /does not exist|undefined function/.test(e.message)) {
        console.warn('[process-due-date-notifications] create_due_date_notifications() not present, skipping planning_items.');
        skipped.push('planning_items');
      } else {
        throw e;
      }
    }

    // 2. Team tasks — RPC create_task_due_date_notifications() (migration 0044)
    try {
      await pool.query('SELECT create_task_due_date_notifications()');
      ran.push('team_tasks');
    } catch (e: any) {
      if (e?.message && /does not exist|undefined function/.test(e.message)) {
        console.warn('[process-due-date-notifications] create_task_due_date_notifications() not present, skipping team_tasks.');
        skipped.push('team_tasks');
      } else {
        throw e;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Due date notifications processed',
      ran,
      skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[process-due-date-notifications] Error:', error);
    return jsonError(res, 500, error?.message || 'Internal error');
  }
}
