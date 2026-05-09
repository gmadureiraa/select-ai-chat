// Migrated from supabase/functions/late-webhook-test/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const TG_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return { ok: false, error: 'Telegram keys not configured' };
  const config = await queryOne<any>(`SELECT chat_id FROM telegram_bot_config WHERE id = 1 LIMIT 1`);
  const chatId = config?.chat_id;
  if (!chatId) return { ok: false, error: 'Telegram chat_id not configured' };

  const r = await fetch(`${TG_GATEWAY}/sendMessage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!r.ok) return { ok: false, error: `Telegram ${r.status}: ${await r.text()}` };
  return { ok: true };
}

export default authedPost(async ({ user, body }) => {
  const { eventType, clientId } = body;
  let clientName = 'Cliente de Teste';
  if (clientId) {
    const c = await queryOne<any>(`SELECT name FROM clients WHERE id = $1`, [clientId]);
    if (c) clientName = c.name;
  }

  let message = '';
  switch (eventType) {
    case 'post.failed':
      message = `🧪 <b>[TESTE] Falha ao publicar</b>\n\n<b>Cliente:</b> ${clientName}\n<b>Plataforma:</b> instagram\n<b>Título:</b> Post de teste do webhook\n<b>Erro:</b> <code>Simulação manual</code>`;
      break;
    case 'post.partial':
      message = `🧪 <b>[TESTE] Publicação parcial</b>\n\n<b>Cliente:</b> ${clientName}\n<b>Falhou em:</b>\n<pre>• tiktok — token expirado\n• threads — rate limit</pre>`;
      break;
    case 'post.cancelled':
      message = `🧪 <b>[TESTE] Post cancelado na Postiz</b>\n\n<b>Cliente:</b> ${clientName}\n<b>Plataforma:</b> instagram`;
      break;
    case 'account.disconnected':
      message = `🧪 <b>[TESTE] Conta DESCONECTOU</b>\n\n<b>Cliente:</b> ${clientName}\n<b>Plataforma:</b> instagram\n\n⚠️ Reconecte em <i>Cliente → Integrações</i>.`;
      break;
    case 'account.expired':
      message = `🧪 <b>[TESTE] Conta EXPIROU</b>\n\n<b>Cliente:</b> ${clientName}\n<b>Plataforma:</b> tiktok\n\n⚠️ Reconecte para retomar publicações.`;
      break;
    case 'ping':
    default:
      message = `🧪 <b>Webhook ping OK</b>\n\nDisparado por <i>${user.email || user.id}</i> em ${new Date().toLocaleString('pt-BR')}.`;
      break;
  }

  const tg = await sendTelegram(message);
  try {
    await getPool().query(
      `INSERT INTO webhook_events_log (source, event_type, payload, processed_ok, error_message, client_id, is_test)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)`,
      ['late', eventType, JSON.stringify({ test: true, triggered_by: user.email, clientId }), tg.ok, tg.error || null, clientId || null, true]
    );
  } catch (e) {
    console.warn('[late-webhook-test] log failed:', e);
  }
  if (!tg.ok) throw new Error(tg.error || 'telegram failed');
  return { success: true, eventType, sentTo: 'telegram' };
});
