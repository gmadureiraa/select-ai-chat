// Migrated from supabase/functions/late-webhook/index.ts
// POST handler — receives webhook events from Late API. Validates HMAC SHA-256 signature.
// Defensive fallback: if LATE_WEBHOOK_SECRET not configured, returns 503.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { createHmac } from 'node:crypto';

const TG_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';
const REQUIRED_ENV = ['LATE_WEBHOOK_SECRET'];

interface LateWebhookEvent {
  type:
    | 'post.published'
    | 'post.failed'
    | 'post.scheduled'
    | 'post.partial'
    | 'post.cancelled'
    | 'post.recycled'
    | 'account.connected'
    | 'account.disconnected'
    | 'account.expired';
  postId?: string;
  accountId?: string;
  profileId?: string;
  platform?: string;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
  timestamp?: string;
  socialAccountId?: string;
  socialPlatform?: string;
  accountName?: string;
  failedPlatforms?: Array<{ platform: string; error?: string }>;
}

function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function readRawBody(req: VercelRequest): Promise<string> {
  // If body already parsed (Vercel auto), serialize back; otherwise read stream.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body;
    return JSON.stringify(req.body);
  }
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', (err: any) => reject(err));
  });
}

function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return signature === expected;
}

async function alertsEnabledForClient(clientId: string | null | undefined): Promise<boolean> {
  if (!clientId) return true;
  const pref = await queryOne<any>(
    `SELECT alerts_enabled FROM webhook_alert_preferences WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  if (!pref) return true; // default ON
  return !!pref.alerts_enabled;
}

async function sendTelegram(text: string, clientId?: string | null): Promise<void> {
  try {
    if (!(await alertsEnabledForClient(clientId))) {
      console.log('Alerts disabled for client', clientId, '— skipping Telegram');
      return;
    }
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
      console.warn('Telegram keys not configured, skipping notification');
      return;
    }
    const config = await queryOne<any>(`SELECT chat_id FROM telegram_bot_config WHERE id = 1`);
    const chatId = config?.chat_id;
    if (!chatId) return;

    const r = await fetch(`${TG_GATEWAY}/sendMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) {
      const data = await r.text();
      console.error('Telegram send failed:', r.status, data);
    }
  } catch (e) {
    console.error('Telegram notify error:', e);
  }
}

async function getClientName(clientId: string | null | undefined): Promise<string> {
  if (!clientId) return 'Cliente';
  const c = await queryOne<any>(`SELECT name FROM clients WHERE id = $1`, [clientId]);
  return c?.name || 'Cliente';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return res.status(503).json({
      error: 'Late webhook not configured',
      missing_env: missing,
      hint: 'Add the missing env vars in Vercel and redeploy',
    });
  }

  const pool = getPool();
  let parsedEvent: LateWebhookEvent | null = null;
  let rawPayload: unknown = null;

  try {
    const rawBody = await readRawBody(req);
    const signature =
      (req.headers['x-late-signature'] as string | undefined) ||
      (req.headers['x-zernio-signature'] as string | undefined) ||
      (req.headers['x-webhook-signature'] as string | undefined) ||
      null;

    const valid = verifyWebhookSignature(rawBody, signature || null, process.env.LATE_WEBHOOK_SECRET!);
    if (!valid) {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        ['late', 'invalid_signature', JSON.stringify({ body_preview: rawBody.substring(0, 500) }), false, 'Invalid or missing x-late-signature']
      );
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event: LateWebhookEvent = JSON.parse(rawBody);
    parsedEvent = event;
    rawPayload = event;

    console.log('Late webhook received:', event.type);

    // ─────── ACCOUNT EVENTS ───────
    if (event.type === 'account.disconnected' || event.type === 'account.expired') {
      const accountId = event.accountId || event.socialAccountId;
      const platform = event.platform || event.socialPlatform || 'rede social';

      let affectedClientName = 'um cliente';
      let affectedClientId: string | null = null;

      if (accountId) {
        const credentials = await query<any>(
          `SELECT id, client_id, platform FROM client_social_credentials
            WHERE metadata->>'late_account_id' = $1 OR metadata->>'late_profile_id' = $1`,
          [accountId]
        );

        for (const cred of credentials) {
          if (event.type === 'account.disconnected') {
            await pool.query(`DELETE FROM client_social_credentials WHERE id = $1`, [cred.id]);
          } else {
            await pool.query(
              `UPDATE client_social_credentials
                  SET is_valid = FALSE, validation_error = $1, updated_at = NOW()
                WHERE id = $2`,
              ['Conta expirada no Late API', cred.id]
            );
          }
          affectedClientId = cred.client_id;
          affectedClientName = await getClientName(cred.client_id);
        }
      }

      const emoji = event.type === 'account.disconnected' ? '🔌' : '⏰';
      const verb = event.type === 'account.disconnected' ? 'DESCONECTOU' : 'EXPIROU';
      await sendTelegram(
        `${emoji} <b>Conta ${verb}</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(affectedClientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platform)}\n` +
          (event.accountName ? `<b>Conta:</b> ${escapeHtml(event.accountName)}\n` : '') +
          `\n⚠️ Reconecte em <i>Cliente → Integrações</i> para retomar publicações.`,
        affectedClientId
      );

      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, related_client_id, client_id, processed_ok)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
        ['late', event.type, JSON.stringify(rawPayload), affectedClientId, affectedClientId, true]
      );

      return res.status(200).json({ success: true, eventType: event.type });
    }

    // For post events, postId is required
    if (!event.postId) {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        ['late', event.type, JSON.stringify(rawPayload), true, 'skipped — no postId']
      );
      return res.status(200).json({ success: true, message: 'Event skipped - no postId' });
    }

    const planningItem = await queryOne<any>(
      `SELECT * FROM planning_items WHERE external_post_id = $1 LIMIT 1`,
      [event.postId]
    );

    if (!planningItem) {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        ['late', event.type, JSON.stringify(rawPayload), true, 'no matching planning item']
      );
      return res.status(200).json({ success: true, message: 'No matching planning item found' });
    }

    const item = planningItem;
    const clientName = await getClientName(item.client_id);
    const platformLabel = item.platform || event.platform || '—';

    if (event.type === 'post.published') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      let publishedColumnId = item.column_id;
      if (item.workspace_id) {
        const col = await queryOne<any>(
          `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
          [item.workspace_id]
        );
        if (col) publishedColumnId = col.id;
      }

      await pool.query(
        `UPDATE planning_items
           SET status = 'published',
               published_at = $1,
               error_message = NULL,
               column_id = $2,
               metadata = $3::jsonb,
               updated_at = NOW()
         WHERE id = $4`,
        [
          event.timestamp || new Date().toISOString(),
          publishedColumnId,
          JSON.stringify({
            ...existingMetadata,
            published_url: event.platformPostUrl,
            platform_post_id: event.platformPostId,
            published_via_webhook: true,
          }),
          item.id,
        ]
      );

      if (!item.added_to_library && item.client_id) {
        const contentTypeMap: Record<string, string> = {
          twitter: 'tweet',
          linkedin: 'linkedin_post',
          instagram: 'instagram_post',
          facebook: 'facebook_post',
          tiktok: 'tiktok_video',
          youtube: 'youtube_video',
          threads: 'threads_post',
        };
        await pool.query(
          `INSERT INTO client_content_library (client_id, title, content, content_type, content_url, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            item.client_id,
            (item.content || item.title || '').substring(0, 100),
            item.content || item.title || '',
            contentTypeMap[item.platform || ''] || 'post',
            event.platformPostUrl,
            JSON.stringify({
              platform: item.platform,
              posted_at: event.timestamp || new Date().toISOString(),
              late_post_id: event.postId,
              via_webhook: true,
            }),
          ]
        );
        await pool.query(`UPDATE planning_items SET added_to_library = true WHERE id = $1`, [item.id]);
      }
    } else if (event.type === 'post.failed') {
      await pool.query(
        `UPDATE planning_items
           SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE id = $2`,
        [event.error || 'Falha ao publicar automaticamente', item.id]
      );

      await sendTelegram(
        `🔴 <b>Falha ao publicar</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platformLabel)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || '—')}\n` +
          `<b>Erro:</b> <code>${escapeHtml(event.error || 'Desconhecido')}</code>\n\n` +
          `Abra no kAI para revisar e republicar.`,
        item.client_id
      );
    } else if (event.type === 'post.scheduled') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await pool.query(
        `UPDATE planning_items
           SET status = 'scheduled', metadata = $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            ...existingMetadata,
            late_confirmed: true,
            late_scheduled_at: event.timestamp,
          }),
          item.id,
        ]
      );
    } else if (event.type === 'post.partial') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await pool.query(
        `UPDATE planning_items
           SET status = 'partial', metadata = $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            ...existingMetadata,
            failed_platforms: event.failedPlatforms || [],
            published_url: event.platformPostUrl,
            partial_at: event.timestamp || new Date().toISOString(),
          }),
          item.id,
        ]
      );

      const failedList =
        (event.failedPlatforms || [])
          .map((f) => `• ${f.platform}${f.error ? ` — ${f.error}` : ''}`)
          .join('\n') || '(plataformas não informadas)';

      await sendTelegram(
        `🟡 <b>Publicação parcial</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || '—')}\n\n` +
          `<b>Falhou em:</b>\n<pre>${escapeHtml(failedList)}</pre>`,
        item.client_id
      );
    } else if (event.type === 'post.cancelled') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await pool.query(
        `UPDATE planning_items
           SET status = 'cancelled', metadata = $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            ...existingMetadata,
            cancelled_at: event.timestamp || new Date().toISOString(),
            cancelled_via_webhook: true,
          }),
          item.id,
        ]
      );

      await sendTelegram(
        `🟡 <b>Post cancelado na Late</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platformLabel)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || '—')}`,
        item.client_id
      );
    } else if (event.type === 'post.recycled') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await pool.query(
        `UPDATE planning_items
           SET metadata = $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            ...existingMetadata,
            recycled_at: event.timestamp || new Date().toISOString(),
            recycled_post_id: event.platformPostId,
            recycled_url: event.platformPostUrl,
          }),
          item.id,
        ]
      );
    }

    await pool.query(
      `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, related_planning_item_id, related_client_id, client_id)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)`,
      ['late', event.type, JSON.stringify(rawPayload), true, item.id, item.client_id, item.client_id]
    );

    return res.status(200).json({ success: true, eventType: event.type });
  } catch (error: any) {
    console.error('Erro em late-webhook:', error);
    try {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        ['late', parsedEvent?.type || 'unknown', JSON.stringify(rawPayload), false, error instanceof Error ? error.message : String(error)]
      );
    } catch {}
    return res.status(500).json({ error: 'Internal server error' });
  }
}
