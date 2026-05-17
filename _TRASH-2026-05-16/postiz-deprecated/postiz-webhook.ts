// Postiz webhook receiver — substitui late-webhook.
//
// IMPORTANTE: a Postiz Public API ainda NÃO documenta um sistema de webhooks oficial pra
// publish status (até 2026-05). Este handler está pronto pra:
//   1. Receber eventos quando/se Postiz expor webhooks (mesmo shape genérico Late-like).
//   2. Aceitar payloads vindos de automações n8n / scripts externos que escutem o
//      Postiz e formatem eventos `post.published` / `post.failed` / `account.disconnected`.
//
// Validação HMAC: igual Late, headers aceitos: `x-postiz-signature` (preferido),
// fallback `x-late-signature` durante migração, fallback `x-webhook-signature`.
// Secret: `POSTIZ_WEBHOOK_SECRET`.
//
// Mapeamento entre planning_items e Postiz post: usamos `metadata.postiz_post_id` (gravado
// pelo postiz-post handler) E `external_post_id` na coluna planning_items.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { createHmac } from 'node:crypto';

const TG_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';
const REQUIRED_ENV = ['POSTIZ_WEBHOOK_SECRET'];

interface PostizWebhookEvent {
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
  postId?: string; // Postiz post id
  integrationId?: string; // Postiz integration id (conta conectada)
  platform?: string; // identifier postiz (x | linkedin | ...)
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
  timestamp?: string;
  accountName?: string;
  failedPlatforms?: Array<{ platform: string; error?: string }>;
}

function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function readRawBody(req: VercelRequest): Promise<string> {
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
    [clientId],
  );
  if (!pref) return true;
  return !!pref.alerts_enabled;
}

async function sendTelegram(text: string, clientId?: string | null): Promise<void> {
  try {
    if (!(await alertsEnabledForClient(clientId))) return;
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return;
    const config = await queryOne<any>(`SELECT chat_id FROM telegram_bot_config WHERE id = 1`);
    const chatId = config?.chat_id;
    if (!chatId) return;
    await fetch(`${TG_GATEWAY}/sendMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
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
      error: 'Postiz webhook not configured',
      missing_env: missing,
      hint: 'Add POSTIZ_WEBHOOK_SECRET in Vercel and redeploy',
    });
  }

  const pool = getPool();
  let parsedEvent: PostizWebhookEvent | null = null;
  let rawPayload: unknown = null;

  try {
    const rawBody = await readRawBody(req);
    const signature =
      (req.headers['x-postiz-signature'] as string | undefined) ||
      (req.headers['x-late-signature'] as string | undefined) ||
      (req.headers['x-webhook-signature'] as string | undefined) ||
      null;

    const valid = verifyWebhookSignature(rawBody, signature || null, process.env.POSTIZ_WEBHOOK_SECRET!);
    if (!valid) {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          'postiz',
          'invalid_signature',
          JSON.stringify({ body_preview: rawBody.substring(0, 500) }),
          false,
          'Invalid or missing x-postiz-signature',
        ],
      );
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event: PostizWebhookEvent = JSON.parse(rawBody);
    parsedEvent = event;
    rawPayload = event;

    console.log('Postiz webhook received:', event.type);

    // ─────── ACCOUNT EVENTS ───────
    if (event.type === 'account.disconnected' || event.type === 'account.expired') {
      const integrationId = event.integrationId;
      const platform = event.platform || 'rede social';

      let affectedClientName = 'um cliente';
      let affectedClientId: string | null = null;

      if (integrationId) {
        const credentials = await query<any>(
          `SELECT id, client_id, platform FROM client_social_credentials
            WHERE metadata->>'postiz_integration_id' = $1`,
          [integrationId],
        );

        for (const cred of credentials) {
          if (event.type === 'account.disconnected') {
            await pool.query(`DELETE FROM client_social_credentials WHERE id = $1`, [cred.id]);
          } else {
            await pool.query(
              `UPDATE client_social_credentials
                  SET is_valid = FALSE, validation_error = $1, updated_at = NOW()
                WHERE id = $2`,
              ['Conta expirada no Postiz', cred.id],
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
          `\n⚠️ Reconecte em <i>Cliente → Integrações</i>.`,
        affectedClientId,
      );

      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, related_client_id, client_id, processed_ok)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
        ['postiz', event.type, JSON.stringify(rawPayload), affectedClientId, affectedClientId, true],
      );

      return res.status(200).json({ success: true, eventType: event.type });
    }

    if (!event.postId) {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        ['postiz', event.type, JSON.stringify(rawPayload), true, 'skipped — no postId'],
      );
      return res.status(200).json({ success: true, message: 'Event skipped - no postId' });
    }

    const planningItem = await queryOne<any>(
      `SELECT * FROM planning_items WHERE external_post_id = $1 LIMIT 1`,
      [event.postId],
    );

    if (!planningItem) {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        ['postiz', event.type, JSON.stringify(rawPayload), true, 'no matching planning item'],
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
          [item.workspace_id],
        );
        if (col) publishedColumnId = col.id;
      }
      await pool.query(
        `UPDATE planning_items
           SET status = 'published', published_at = $1, error_message = NULL, column_id = $2, metadata = $3::jsonb, updated_at = NOW()
         WHERE id = $4`,
        [
          event.timestamp || new Date().toISOString(),
          publishedColumnId,
          JSON.stringify({
            ...existingMetadata,
            published_url: event.platformPostUrl,
            platform_post_id: event.platformPostId,
            published_via_webhook: true,
            provider: 'postiz',
          }),
          item.id,
        ],
      );

      if (!item.added_to_library && item.client_id) {
        const contentTypeMap: Record<string, string> = {
          twitter: 'tweet',
          x: 'tweet',
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
              postiz_post_id: event.postId,
              via_webhook: true,
              provider: 'postiz',
            }),
          ],
        );
        await pool.query(`UPDATE planning_items SET added_to_library = true WHERE id = $1`, [item.id]);
      }
    } else if (event.type === 'post.failed') {
      await pool.query(
        `UPDATE planning_items SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [event.error || 'Falha ao publicar automaticamente', item.id],
      );
      await sendTelegram(
        `🔴 <b>Falha ao publicar</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platformLabel)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || '—')}\n` +
          `<b>Erro:</b> <code>${escapeHtml(event.error || 'Desconhecido')}</code>`,
        item.client_id,
      );
    } else if (event.type === 'post.scheduled') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await pool.query(
        `UPDATE planning_items SET status = 'scheduled', metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [
          JSON.stringify({
            ...existingMetadata,
            postiz_confirmed: true,
            postiz_scheduled_at: event.timestamp,
            provider: 'postiz',
          }),
          item.id,
        ],
      );
    } else if (event.type === 'post.partial') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await pool.query(
        `UPDATE planning_items SET status = 'partial', metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [
          JSON.stringify({
            ...existingMetadata,
            failed_platforms: event.failedPlatforms || [],
            published_url: event.platformPostUrl,
            partial_at: event.timestamp || new Date().toISOString(),
            provider: 'postiz',
          }),
          item.id,
        ],
      );
      const failedList =
        (event.failedPlatforms || []).map((f) => `• ${f.platform}${f.error ? ` — ${f.error}` : ''}`).join('\n') ||
        '(plataformas não informadas)';
      await sendTelegram(
        `🟡 <b>Publicação parcial</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || '—')}\n\n` +
          `<b>Falhou em:</b>\n<pre>${escapeHtml(failedList)}</pre>`,
        item.client_id,
      );
    } else if (event.type === 'post.cancelled') {
      const existingMetadata = (item.metadata as Record<string, unknown>) || {};
      await pool.query(
        `UPDATE planning_items SET status = 'cancelled', metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [
          JSON.stringify({
            ...existingMetadata,
            cancelled_at: event.timestamp || new Date().toISOString(),
            cancelled_via_webhook: true,
            provider: 'postiz',
          }),
          item.id,
        ],
      );
      await sendTelegram(
        `🟡 <b>Post cancelado no Postiz</b>\n\n` +
          `<b>Cliente:</b> ${escapeHtml(clientName)}\n` +
          `<b>Plataforma:</b> ${escapeHtml(platformLabel)}\n` +
          `<b>Título:</b> ${escapeHtml(item.title || '—')}`,
        item.client_id,
      );
    }

    await pool.query(
      `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, related_planning_item_id, related_client_id, client_id)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)`,
      ['postiz', event.type, JSON.stringify(rawPayload), true, item.id, item.client_id, item.client_id],
    );

    return res.status(200).json({ success: true, eventType: event.type });
  } catch (error: any) {
    console.error('Erro em postiz-webhook:', error);
    try {
      await pool.query(
        `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          'postiz',
          parsedEvent?.type || 'unknown',
          JSON.stringify(rawPayload),
          false,
          error instanceof Error ? error.message : String(error),
        ],
      );
    } catch {}
    return res.status(500).json({ error: 'Internal server error' });
  }
}
