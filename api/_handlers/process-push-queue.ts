// Migrated from supabase/functions/process-push-queue/index.ts
// Cron job that drains push_notification_queue, sends Web Push notifications
// (VAPID + aes128gcm) and prunes expired subscriptions (404/410).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { getPool, query } from '../_lib/db.js';
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
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: SOMENTE cron — drena fila global de push notifications.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!isCron) {
    return jsonError(res, 403, 'Cron-only endpoint');
  }

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

    // Fetch pending items (limit 100)
    const queueItems = await query<QueueItem>(
      `SELECT id, user_id, payload
         FROM push_notification_queue
        WHERE processed = false
        ORDER BY created_at ASC
        LIMIT 100`
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

    if (processedIds.length > 0) {
      await pool.query(
        `UPDATE push_notification_queue
            SET processed = true, processed_at = now()
          WHERE id = ANY($1::uuid[])`,
        [processedIds]
      );
    }

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
