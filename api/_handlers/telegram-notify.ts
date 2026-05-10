// Migrated from supabase/functions/telegram-notify/index.ts
// Sends rich (text or photo) Telegram notification with inline keyboard.
// Uses TELEGRAM_BOT_TOKEN env (no Lovable connector gateway).
//
// Auth (atualizado 2026-05-10): cron OR user logado. Nunca anônimo (qualquer
// um podia spammar o bot). Cron pra notify automático em fluxos backend.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { tryAuth } from '../_lib/auth.js';
import { queryOne } from '../_lib/db.js';

const PLATFORM_EMOJI: Record<string, string> = {
  twitter: '🐦',
  linkedin: '💼',
  instagram: '📸',
  threads: '🧵',
  tiktok: '🎵',
  blog: '📝',
  newsletter: '📧',
};

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function tgSendMessage(token: string, chatId: any, text: string, replyMarkup: any) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`Telegram sendMessage failed [${r.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

async function tgSendPhoto(
  token: string,
  chatId: any,
  photo: string,
  caption: string,
  replyMarkup: any,
) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo,
      caption,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  // Auth: cron (Bearer CRON_SECRET) OR user logado (JWT). Nunca anônimo.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const isCron = authHeader === `Bearer ${cronSecret}` && !!cronSecret;
  if (!isCron) {
    const user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Authentication required');
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) return jsonError(res, 500, 'TELEGRAM_BOT_TOKEN is not configured');

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});

  const {
    item_id,
    title,
    content,
    image_url,
    platform,
    client_name,
    automation_name,
    content_type,
    chat_id: overrideChatId,
    published,
    published_urls,
  } = body as any;

  // chat_id resolution
  let chatId: any = overrideChatId;
  if (!chatId) {
    const config = await queryOne<any>(
      `SELECT chat_id FROM telegram_bot_config WHERE id = 1`,
    ).catch(() => null);
    chatId = config?.chat_id;
  }
  if (!chatId) chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return res.status(200).json({ error: 'No chat_id configured. Send /start to the bot first.' });
  }

  const emoji = PLATFORM_EMOJI[platform || ''] || '📋';
  const contentPreview = content ? content.substring(0, 800) : 'Sem conteúdo';

  const isPublished = published === true;
  const headerText = isPublished
    ? `${emoji} <b>✅ Conteúdo publicado automaticamente</b>`
    : `${emoji} <b>📋 Novo conteúdo para revisão</b>`;

  const publishedUrlsText = published_urls
    ? Object.entries(published_urls as Record<string, string>)
        .map(([p, url]) => `🔗 ${p}: ${url}`)
        .join('\n')
    : '';

  const messageText = [
    headerText,
    '',
    `<b>Automação:</b> ${escapeHtml(automation_name || 'N/A')}`,
    `<b>Cliente:</b> ${escapeHtml(client_name || 'N/A')}`,
    `<b>Plataforma:</b> ${escapeHtml(platform || 'N/A')}`,
    `<b>Tipo:</b> ${escapeHtml(content_type || 'N/A')}`,
    '',
    `<b>Título:</b> ${escapeHtml(title || 'Sem título')}`,
    '',
    `<pre>${escapeHtml(contentPreview)}</pre>`,
    publishedUrlsText ? `\n${publishedUrlsText}` : '',
    !isPublished ? `\n⬇️ <i>Escolha uma ação abaixo:</i>` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const inlineKeyboard = isPublished
    ? {
        inline_keyboard: [
          [
            { text: '👍 Gostei', callback_data: `fb_like:${item_id}` },
            { text: '👎 Não gostei', callback_data: `fb_dislike:${item_id}` },
            { text: '🗑️ Apagar + Refazer', callback_data: `fb_delete:${item_id}` },
          ],
          [{ text: '📋 Ver no painel', callback_data: `view:${item_id}` }],
        ],
      }
    : {
        inline_keyboard: [
          [
            { text: '✅ Aprovar', callback_data: `approve:${item_id}` },
            { text: '❌ Reprovar', callback_data: `reject:${item_id}` },
          ],
          [
            { text: '🔄 Regenerar', callback_data: `regen:${item_id}` },
            { text: '📝 Publicar agora', callback_data: `publish:${item_id}` },
          ],
        ],
      };

  let sentMessage: any;
  if (image_url) {
    const caption = messageText.length > 1024 ? messageText.substring(0, 1000) + '...' : messageText;
    const photoRes = await tgSendPhoto(
      TELEGRAM_BOT_TOKEN,
      chatId,
      image_url,
      caption,
      inlineKeyboard,
    );
    if (!photoRes.ok) {
      console.error(
        '[telegram-notify] photo send failed, falling back to text:',
        JSON.stringify(photoRes.data),
      );
      sentMessage = await tgSendMessage(TELEGRAM_BOT_TOKEN, chatId, messageText, inlineKeyboard);
    } else {
      sentMessage = photoRes.data;
    }
  } else {
    sentMessage = await tgSendMessage(TELEGRAM_BOT_TOKEN, chatId, messageText, inlineKeyboard);
  }

    console.log(`[telegram-notify] sent for item ${item_id}`);
    return res.status(200).json({
      success: true,
      message_id: sentMessage?.result?.message_id,
    });
  } catch (e: any) {
    console.error('[telegram-notify] error:', e);
    return jsonError(res, 500, e?.message || 'Internal error');
  }
}
