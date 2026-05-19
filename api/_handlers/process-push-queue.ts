// Migrated from supabase/functions/process-push-queue/index.ts
// Cron job that drains push_notification_queue, sends Web Push notifications
// (VAPID + aes128gcm) and prunes expired subscriptions (404/410).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { getPool, query } from '../_lib/db.js';
import { assertCronAuth } from '../_lib/cron-auth.js';
import {
  sendWebPush,
  type PushSubscription,
  type PushPayload,
} from '../_lib/shared/web-push.js';

interface QueueItem {
  id: string;
  user_id: string;
  payload: PushPayload;
}

interface SubscriptionRow extends PushSubscription {
  id: string;
  user_id: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: SOMENTE cron — drena fila global de push notifications.
  if (!assertCronAuth(req, res)) return;

  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log('[process-push-queue] VAPID keys not configured, skipping');
      return res.status(200).json({
        success: true,
        processed: 0,
        message: 'VAPID not configured',
      });
    }

    // Fetch pending items (limit 100).
    //
    // CONCURRENCY: cron roda a cada 5min. Se 2 invocations rodarem em
    // paralelo (cold + warm), ambos pegariam os mesmos 100 itens, mandariam
    // 2x push notifications pro mesmo user e tentariam UPDATE ... SET
    // processed=true 2x (não quebra, mas é trabalho duplicado e SPAM no
    // device do user).
    //
    // Fix: SELECT FOR UPDATE SKIP LOCKED dentro de uma CTE + UPDATE marca
    // processed=true ANTES de enviar. Se o envio falhar, o caller revert via
    // UPDATE processed=false (não fazemos isso porque expired subs viram
    // DELETE direto). Trade-off: se a invocation morrer mid-envio, o item
    // fica como processed=true sem ter sido enviado de fato. Aceitável
    // porque (a) é só notification (não cobrança), (b) push é best-effort,
    // (c) probabilidade baixíssima (5min lifetime de Vercel function).
    const queueItems = await query<QueueItem>(
      `WITH picked AS (
         SELECT id
           FROM push_notification_queue
          WHERE processed = false
          ORDER BY created_at ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED
       )
       UPDATE push_notification_queue q
          SET processed = true,
              processed_at = NOW()
         FROM picked p
        WHERE q.id = p.id
       RETURNING q.id, q.user_id, q.payload`
    );

    if (queueItems.length === 0) {
      console.log('[process-push-queue] no pending items');
      return res.status(200).json({ success: true, processed: 0 });
    }

    console.log(`[process-push-queue] processing ${queueItems.length} items`);

    const userIds = [...new Set(queueItems.map((it) => it.user_id))];
    const allSubs = await query<SubscriptionRow>(
      `SELECT id, user_id, endpoint, p256dh, auth
         FROM push_subscriptions
        WHERE user_id = ANY($1::uuid[])`,
      [userIds]
    );

    const subscriptionsByUser: Record<string, SubscriptionRow[]> = {};
    for (const sub of allSubs) {
      if (!subscriptionsByUser[sub.user_id]) subscriptionsByUser[sub.user_id] = [];
      subscriptionsByUser[sub.user_id].push(sub);
    }

    let totalSent = 0;
    const processedIds: string[] = [];
    const expiredSubscriptionIds: string[] = [];

    for (const item of queueItems) {
      const userSubscriptions = subscriptionsByUser[item.user_id] || [];

      if (userSubscriptions.length === 0) {
        console.log(
          `[process-push-queue] no subscriptions for user ${item.user_id.substring(0, 8)}`
        );
        processedIds.push(item.id);
        continue;
      }

      for (const subscription of userSubscriptions) {
        const result = await sendWebPush(
          {
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
          item.payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        if (result.success) {
          totalSent++;
          console.log(
            `[process-push-queue] push sent to ${subscription.endpoint.substring(0, 40)}`
          );
        } else if (result.statusCode === 404 || result.statusCode === 410) {
          expiredSubscriptionIds.push(subscription.id);
          console.log(
            `[process-push-queue] subscription expired: ${subscription.id}`
          );
        } else {
          console.error(
            `[process-push-queue] push failed: status=${result.statusCode} error=${result.error}`
          );
        }
      }

      processedIds.push(item.id);
    }

    const pool = getPool();

    // NB: processed=true já foi setado atomicamente no pickup CTE.
    // Manteríamos processedIds só pra auditar/log — mas não precisa update.

    if (expiredSubscriptionIds.length > 0) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE id = ANY($1::uuid[])`,
        [expiredSubscriptionIds]
      );
      console.log(
        `[process-push-queue] removed ${expiredSubscriptionIds.length} expired subscriptions`
      );
    }

    console.log(
      `[process-push-queue] done. sent=${totalSent} processed=${processedIds.length}`
    );

    return res.status(200).json({
      success: true,
      processed: processedIds.length,
      sent: totalSent,
      expiredRemoved: expiredSubscriptionIds.length,
    });
  } catch (error: any) {
    console.error('[process-push-queue] error:', error);
    return jsonError(res, 500, error?.message || 'Unknown error');
  }
}
