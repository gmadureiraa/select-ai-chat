// Migrated from supabase/functions/send-push-notification/index.ts
// Web Push (RFC8030) sender — usa helper compartilhado `api/_lib/shared/web-push.ts`
// que retorna { success, statusCode, error }. Permite distinguir 404/410 (deletar
// subscription expirada) de exception/5xx/network blip (manter pra retry).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { isValidCronCall } from '../_lib/cron-auth.js';
import {
  sendWebPush,
  type PushPayload,
  type PushSubscription as Subscription,
} from '../_lib/shared/web-push.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth: cron (Bearer CRON_SECRET; broadcast pra qualquer user) OR authed user
  // (só pra si OU workspace dele). Header `x-vercel-cron` standalone NÃO conta.
  const isCron = isValidCronCall(req);
  let authedUser: { id: string } | null = null;
  if (!isCron) {
    authedUser = await tryAuth(req);
    if (!authedUser) return jsonError(res, 401, 'Unauthorized');
  }

  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
        ? JSON.parse(req.body)
        : {};
    const { userId, workspaceId, payload } = body as {
      userId?: string;
      workspaceId?: string;
      payload: PushPayload;
    };

    if (!userId && !workspaceId) {
      throw new Error('userId or workspaceId required');
    }
    if (!payload || !payload.title) {
      throw new Error('payload.title is required');
    }

    // Defesa contra spam: user logado SÓ pode enviar pra si mesmo OU pro
    // workspace ao qual pertence. Cron pode pra qualquer um.
    if (!isCron && authedUser) {
      if (userId && userId !== authedUser.id) {
        return jsonError(res, 403, 'Cannot send push to another user');
      }
      if (workspaceId) {
        const member = await query<any>(
          `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
          [workspaceId, authedUser.id],
        );
        if (member.length === 0) {
          return jsonError(res, 403, 'Não membro desse workspace');
        }
      }
    }

    const subscriptions = userId
      ? await query<any>(
          `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
          [userId],
        )
      : await query<any>(
          `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE workspace_id = $1`,
          [workspaceId],
        );

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] no subscriptions for user/workspace');
      return res.status(200).json({ success: true, sent: 0, message: 'No subscriptions' });
    }

    console.log(`[send-push] ${subscriptions.length} subscription(s)`);

    const results = await Promise.all(
      subscriptions.map(async (sub: any) => {
        const sendResult = await sendWebPush(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          } satisfies Subscription,
          payload,
          vapidPublicKey,
          vapidPrivateKey,
        );

        if (sendResult.success) {
          console.log('[send-push] ok:', sub.endpoint.substring(0, 50));
          return true;
        }

        // SÓ deletar quando subscription expirou de verdade (404/410).
        // 5xx, 429, timeout, network blip → MANTER. Outras execuções tentam de novo.
        if (sendResult.statusCode === 404 || sendResult.statusCode === 410) {
          await getPool()
            .query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id])
            .catch(() => null);
          console.log(`[send-push] removed expired subscription ${sub.id} (status=${sendResult.statusCode})`);
        } else {
          console.warn(
            `[send-push] failed but keeping subscription ${sub.id}: status=${sendResult.statusCode} error=${sendResult.error}`,
          );
        }
        return false;
      }),
    );
    const successCount = results.filter(Boolean).length;
    console.log(`[send-push] sent: ${successCount}/${subscriptions.length}`);
    return res.status(200).json({
      success: true,
      sent: successCount,
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error('[send-push] error:', error);
    return jsonError(res, 500, error?.message || 'Unknown error');
  }
}
