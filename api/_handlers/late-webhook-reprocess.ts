// Migrated from supabase/functions/late-webhook-reprocess/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const TG_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return { ok: false, error: 'Telegram not configured' };
  const config = await queryOne<any>(`SELECT chat_id FROM telegram_bot_config WHERE id = 1`);
  const chatId = config?.chat_id;
  if (!chatId) return { ok: false, error: 'No chat_id' };
  const r = await fetch(`${TG_GATEWAY}/sendMessage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'X-Connection-Api-Key': TELEGRAM_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!r.ok) return { ok: false, error: `${r.status}: ${await r.text()}` };
  return { ok: true };
}

export default authedPost(async ({ user, body }) => {
  const { eventLogId } = body;
  if (!eventLogId) throw new Error('Missing eventLogId');

  const ev = await queryOne<any>(`SELECT * FROM webhook_events_log WHERE id = $1`, [eventLogId]);
  if (!ev) throw new Error('Event not found');

  const summary =
    `🔁 <b>Reprocessando webhook</b>\n\n` +
    `<b>Tipo:</b> <code>${ev.event_type}</code>\n` +
    `<b>Recebido em:</b> ${new Date(ev.created_at).toLocaleString('pt-BR')}\n` +
    (ev.error_message ? `<b>Erro original:</b> <code>${String(ev.error_message).substring(0, 200)}</code>\n` : '') +
    `\nReprocessado por <i>${user.email || user.id}</i>.`;

  const tg = await sendTelegram(summary);

  await getPool().query(
    `UPDATE webhook_events_log
        SET retry_count = COALESCE(retry_count, 0) + 1,
            processed_ok = CASE WHEN $1 THEN TRUE ELSE processed_ok END,
            error_message = CASE WHEN $1 THEN NULL ELSE error_message END
      WHERE id = $2`,
    [tg.ok, eventLogId]
  );
  return { success: true, telegram: tg.ok, retryCount: (ev.retry_count || 0) + 1 };
});
