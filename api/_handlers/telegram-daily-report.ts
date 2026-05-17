// Migrated from supabase/functions/telegram-daily-report/index.ts
// Cron-style daily Telegram digest (drafts/review/approved/published + next 7d).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { query, queryOne } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { isValidCronCall } from '../_lib/cron-auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: cron (Bearer CRON_SECRET) OR authed user.
  // Header `x-vercel-cron` standalone NÃO conta.
  const isCron = isValidCronCall(req);
  if (!isCron) {
    const user = await tryAuth(req);
    if (!user) return jsonError(res, 401, 'Unauthorized');
  }

  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

    const config = await queryOne<any>(
      `SELECT chat_id, is_active FROM telegram_bot_config WHERE id = 1`,
    ).catch(() => null);
    const chatId = config?.chat_id || process.env.TELEGRAM_CHAT_ID;
    const isActive = config?.is_active ?? !!process.env.TELEGRAM_CHAT_ID;
    if (!chatId || !isActive) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'No chat_id or inactive' });
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Counts
    const [drafts, inReview, approved, publishedYesterday, publishedToday] = await Promise.all([
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM planning_items WHERE status = 'draft'`,
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM planning_items WHERE status = 'review'`,
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM planning_items WHERE status = 'approved'`,
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM planning_items
         WHERE status = 'published'
           AND updated_at >= $1 AND updated_at < $2`,
        [yesterday, today],
      ),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM planning_items
         WHERE status = 'published'
           AND updated_at >= $1`,
        [today],
      ),
    ]);

    const totalPending = (drafts?.c || 0) + (inReview?.c || 0);

    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString();
    const upcoming = await query<any>(
      `SELECT title, platform, scheduled_at, status
       FROM planning_items
       WHERE status IN ('scheduled', 'approved')
         AND scheduled_at IS NOT NULL
         AND scheduled_at >= NOW()
         AND scheduled_at <= $1
       ORDER BY scheduled_at ASC
       LIMIT 8`,
      [in7Days],
    );

    const upcomingText =
      upcoming.length > 0
        ? '\n\n📅 <b>Próximos 7 dias:</b>\n' +
          upcoming
            .map((i: any) => {
              const date = new Date(i.scheduled_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return `• ${(i.title || '').substring(0, 50)} (${i.platform || 'N/A'}) — ${date}`;
            })
            .join('\n')
        : '\n\n✨ Nenhum agendado para os próximos 7 dias.';

    const pendingLine =
      totalPending === 0
        ? `🎉 <b>Zero pendências!</b> Tudo em dia.`
        : `📝 Pendentes: <b>${totalPending}</b> (${drafts?.c || 0} rascunhos, ${inReview?.c || 0} em revisão)`;

    const message = [
      `☀️ <b>Relatório Diário — kAI</b>`,
      ``,
      pendingLine,
      `✅ Aprovados aguardando agendamento: <b>${approved?.c || 0}</b>`,
      `📤 Publicados ontem: <b>${publishedYesterday?.c || 0}</b>`,
      `📤 Publicados hoje: <b>${publishedToday?.c || 0}</b>`,
      upcomingText,
    ].join('\n');

    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const data = (await response.json().catch(() => ({}))) as any;
    return res.status(200).json({
      ok: response.ok,
      message_id: data?.result?.message_id,
    });
  } catch (error: any) {
    console.error('[telegram-daily-report] error:', error);
    return jsonError(res, 500, error?.message || 'fatal');
  }
}
