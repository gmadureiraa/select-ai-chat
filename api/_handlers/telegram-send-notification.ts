// Migrated from supabase/functions/telegram-send-notification/index.ts
// Sends a planning_item approval message to Telegram via direct Bot API.
// Uses TELEGRAM_BOT_TOKEN env (no Lovable connector gateway).
import { authedPost } from '../_lib/handler.js';
import { queryOne } from '../_lib/db.js';

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PLATFORM_EMOJI: Record<string, string> = {
  twitter: '🐦',
  linkedin: '💼',
  instagram: '📸',
  threads: '🧵',
  tiktok: '🎵',
  blog: '📝',
  newsletter: '📧',
};

export default authedPost(async ({ body }) => {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const { itemId, chatId: overrideChatId } = body as {
    itemId?: string;
    chatId?: string | number;
  };
  if (!itemId) throw new Error('itemId is required');

  // chat_id resolution order: override -> telegram_bot_config -> TELEGRAM_CHAT_ID env
  let chatId: string | number | undefined = overrideChatId;
  if (!chatId) {
    const config = await queryOne<any>(
      `SELECT chat_id FROM telegram_bot_config WHERE id = 1`,
    ).catch(() => null);
    chatId = config?.chat_id;
  }
  if (!chatId) chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error('No chat_id configured (telegram_bot_config or TELEGRAM_CHAT_ID env)');

  const item = await queryOne<any>(
    `SELECT pi.*, c.name AS client_name
     FROM planning_items pi
     LEFT JOIN clients c ON c.id = pi.client_id
     WHERE pi.id = $1`,
    [itemId],
  );
  if (!item) {
    return { error: 'Item not found' };
  }

  const clientName = item.client_name || 'Cliente';
  const preview = (item.content || '').substring(0, 800);
  const emoji = PLATFORM_EMOJI[item.platform || ''] || '📝';

  const message =
    `${emoji} <b>Novo conteúdo para aprovação</b>\n\n` +
    `👤 <b>Cliente:</b> ${escapeHtml(clientName)}\n` +
    `📋 <b>Tipo:</b> ${escapeHtml(item.content_type || 'post')}\n` +
    `📌 <b>Título:</b> ${escapeHtml(item.title || '')}\n\n` +
    `<pre>${escapeHtml(preview)}</pre>`;

  const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(tgUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Aprovar', callback_data: `approve:${itemId}` },
            { text: '❌ Reprovar', callback_data: `reject:${itemId}` },
          ],
          [
            { text: '🔄 Regenerar', callback_data: `regen:${itemId}` },
            { text: '📝 Publicar agora', callback_data: `publish:${itemId}` },
          ],
        ],
      },
    }),
  });

  const result = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    console.error('[telegram-send-notification] error:', JSON.stringify(result));
    return { error: 'Failed to send', details: result };
  }
  console.log(
    '[telegram-send-notification] sent message_id:',
    result?.result?.message_id,
  );
  return { ok: true, messageId: result?.result?.message_id };
});
