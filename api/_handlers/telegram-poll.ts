// Migrated from supabase/functions/telegram-poll/index.ts
// Polls Telegram for new updates and processes commands + callback queries.
// Uses direct Telegram Bot API (not Lovable connector gateway).
// Defensive fallback: if TELEGRAM_BOT_TOKEN not configured, returns 503.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';

const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN'];
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

function tgUrl(method: string): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendReply(
  chatId: number | string,
  text: string,
  replyMarkup?: any,
  forceReplyMarkup?: any
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  else if (forceReplyMarkup) body.reply_markup = forceReplyMarkup;

  const r = await fetch(tgUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) console.error('sendReply failed:', data);
  return data;
}

async function editMessage(chatId: number | string, messageId: number, text: string) {
  const r = await fetch(tgUrl('editMessageText'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) console.error('editMessage failed:', data);
  return data;
}

// =====================================================
// Internal helper: call other Vercel handlers
// =====================================================
async function callInternalHandler(req: VercelRequest, slug: string, body: any): Promise<Response> {
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string;
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
  const url = `${proto}://${host}/api/${slug}`;
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Internal call: forward incoming auth (cron job will use service-level token)
      ...(req.headers.authorization
        ? { Authorization: req.headers.authorization as string }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

// =====================================================
// Handle callback queries (button presses)
// =====================================================
async function handleCallback(callback: any, req: VercelRequest) {
  const data = callback.data;
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;

  console.log(`[telegram-poll] Callback: data="${data}", chatId=${chatId}`);
  if (!data) return;

  const colonIndex = data.indexOf(':');
  const action = colonIndex > -1 ? data.substring(0, colonIndex) : data;
  const itemId = colonIndex > -1 ? data.substring(colonIndex + 1) : null;

  // Answer callback to remove loading state
  await fetch(tgUrl('answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callback.id }),
  }).catch(() => {});

  if (!itemId || itemId === 'undefined' || itemId === 'null') {
    await sendReply(chatId, '❌ ID do item não encontrado no botão. Tente via /pendentes.');
    return;
  }

  const pool = getPool();

  switch (action) {
    case 'approve': {
      const item = await queryOne<any>(
        `SELECT workspace_id, title, status, client_id, content, media_urls, metadata, content_type, platform
           FROM planning_items WHERE id = $1`,
        [itemId]
      );

      if (!item) {
        await sendReply(chatId, `❌ Item não encontrado (ID: ${itemId.substring(0, 8)}...).`);
        return;
      }

      const approvedColumn = await queryOne<any>(
        `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'approved' LIMIT 1`,
        [item.workspace_id]
      );

      if (approvedColumn) {
        await pool.query(`UPDATE planning_items SET status = 'approved', column_id = $1 WHERE id = $2`, [
          approvedColumn.id,
          itemId,
        ]);
      } else {
        await pool.query(`UPDATE planning_items SET status = 'approved' WHERE id = $1`, [itemId]);
      }

      const itemMeta = (item.metadata as any) || {};

      // Auto-publish on approve
      if (itemMeta.auto_publish_on_approve && item.client_id) {
        await editMessage(chatId, messageId, `✅ <b>Aprovado!</b> Publicando...\n"${item.title}"`);

        const targetPlatforms: string[] =
          itemMeta.target_platforms || [item.platform].filter(Boolean);
        const generatedContent = item.content || '';
        let publishSuccess = false;

        for (const targetPlatform of targetPlatforms) {
          try {
            const publishBody: Record<string, unknown> = {
              clientId: item.client_id,
              platform: targetPlatform,
              content: generatedContent,
              planningItemId: itemId,
            };

            if (item.content_type === 'thread' && itemMeta.thread_tweets?.length > 0) {
              publishBody.threadItems = itemMeta.thread_tweets.map((t: any) => ({
                text: t.text,
                media_urls: t.media_urls || [],
              }));
            }

            if (item.content_type === 'carousel' && itemMeta.carousel_slides?.length > 0) {
              const carouselMedia: { url: string; type: string }[] = [];
              for (const slide of itemMeta.carousel_slides) {
                if (slide.media_urls?.length > 0) {
                  for (const url of slide.media_urls) {
                    carouselMedia.push({
                      url,
                      type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                    });
                  }
                }
              }
              if (carouselMedia.length > 0) publishBody.mediaItems = carouselMedia;
            }

            if (
              !publishBody.threadItems &&
              !publishBody.mediaItems &&
              item.media_urls?.length > 0
            ) {
              publishBody.mediaItems = item.media_urls.map((url: string) => ({
                url,
                type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
              }));
            }

            const publishResponse = await callInternalHandler(req, 'late-post', publishBody);

            if (publishResponse.ok) {
              const publishResult = await publishResponse.json();
              const externalPostId = publishResult.externalId || publishResult.postId;

              if (publishResult.success && externalPostId) {
                publishSuccess = true;
                await pool.query(
                  `UPDATE planning_items
                      SET status = 'published',
                          external_post_id = $1,
                          metadata = $2::jsonb
                    WHERE id = $3`,
                  [
                    externalPostId,
                    JSON.stringify({
                      ...itemMeta,
                      auto_published: true,
                      published_at: new Date().toISOString(),
                      late_post_id: externalPostId,
                      pending_telegram_approval: false,
                      published_platforms: [
                        ...(itemMeta.published_platforms || []),
                        targetPlatform,
                      ],
                    }),
                    itemId,
                  ]
                );

                const postUrl = publishResult.postUrl || publishResult.url || '';
                const urlText = postUrl ? `\n🔗 ${postUrl}` : '';
                await sendReply(chatId, `📤 <b>Publicado em ${targetPlatform}!</b>${urlText}`);
              } else {
                await sendReply(
                  chatId,
                  `⚠️ ${targetPlatform}: ${publishResult.error || 'Falha na publicação'}`
                );
              }
            } else {
              const errText = await publishResponse.text();
              await sendReply(chatId, `❌ ${targetPlatform}: ${errText.substring(0, 200)}`);
            }
          } catch (err: any) {
            await sendReply(chatId, `❌ ${targetPlatform}: ${err?.message || 'erro'}`);
          }
        }

        if (!publishSuccess) {
          await sendReply(
            chatId,
            `⚠️ Aprovado mas publicação falhou. Tente via /pendentes ou pelo painel.`
          );
        }
      } else {
        await editMessage(chatId, messageId, `✅ <b>Aprovado!</b>\n"${item.title}"`);
      }
      break;
    }

    case 'reject': {
      const item = await queryOne<any>(`SELECT title FROM planning_items WHERE id = $1`, [itemId]);
      await editMessage(chatId, messageId, `❌ <b>Reprovado.</b>\n"${item?.title || itemId}"`);

      await pool.query(
        `UPDATE telegram_bot_config SET pending_rejection_item_id = $1, updated_at = NOW() WHERE id = 1`,
        [itemId]
      );

      await sendReply(
        chatId,
        `📝 Qual o motivo da reprovação de "<b>${escapeHtml(
          item?.title || 'item'
        )}</b>"?\n\n<i>Responda com o feedback ou envie /pular para reprovar sem motivo.</i>`,
        undefined,
        { force_reply: true, selective: true }
      );

      await pool.query(`UPDATE planning_items SET status = 'rejected' WHERE id = $1`, [itemId]);
      break;
    }

    case 'regen': {
      await editMessage(chatId, messageId, `🔄 <b>Regenerando conteúdo...</b>`);

      const item = await queryOne<any>(
        `SELECT pi.*, c.name as client_name FROM planning_items pi
           LEFT JOIN clients c ON c.id = pi.client_id
          WHERE pi.id = $1`,
        [itemId]
      );

      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.');
        return;
      }

      try {
        const regenResponse = await callInternalHandler(req, 'unified-content-api', {
          brief: item.title,
          clientId: item.client_id,
          formatType: item.content_type || 'tweet',
        });

        if (regenResponse.ok) {
          const result = await regenResponse.json();
          const newContent = result.content || result.text;

          if (newContent) {
            await pool.query(
              `UPDATE planning_items SET content = $1, status = 'idea' WHERE id = $2`,
              [newContent, itemId]
            );

            const preview = newContent.substring(0, 800);
            await sendReply(
              chatId,
              `🔄 <b>Conteúdo regenerado!</b>\n\n<pre>${escapeHtml(preview)}</pre>`,
              {
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
              }
            );
          } else {
            await sendReply(chatId, '⚠️ Regeneração retornou sem conteúdo.');
          }
        } else {
          const errText = await regenResponse.text();
          await sendReply(chatId, `⚠️ Erro ao regenerar: ${errText.substring(0, 200)}`);
        }
      } catch (err: any) {
        await sendReply(chatId, `⚠️ Erro: ${err?.message || 'desconhecido'}`);
      }
      break;
    }

    case 'publish': {
      await editMessage(chatId, messageId, `📝 <b>Publicando...</b>`);

      const item = await queryOne<any>(`SELECT * FROM planning_items WHERE id = $1`, [itemId]);
      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.');
        return;
      }

      try {
        const platform =
          item.platform || (item.metadata as any)?.target_platforms?.[0] || 'twitter';

        const publishResponse = await callInternalHandler(req, 'late-post', {
          clientId: item.client_id,
          platform,
          content: item.content,
          planningItemId: itemId,
          mediaItems:
            item.media_urls?.map((url: string) => ({
              url,
              type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
            })) || [],
        });

        if (publishResponse.ok) {
          const result = await publishResponse.json();
          if (result.success) {
            const postUrl = result.postUrl || result.url || '';
            const urlText = postUrl ? `\n🔗 ${postUrl}` : '';
            await sendReply(
              chatId,
              `✅ <b>Publicado com sucesso!</b> Plataforma: ${platform}${urlText}`
            );
          } else {
            await sendReply(chatId, `⚠️ Late API retornou: ${result.error || 'erro'}`);
          }
        } else {
          const errText = await publishResponse.text();
          await sendReply(chatId, `❌ Erro ao publicar: ${errText.substring(0, 200)}`);
        }
      } catch (err: any) {
        await sendReply(chatId, `❌ Erro: ${err?.message || 'desconhecido'}`);
      }
      break;
    }

    case 'fb_like': {
      const item = await queryOne<any>(
        `SELECT title, content, client_id, platform, content_type, metadata
           FROM planning_items WHERE id = $1`,
        [itemId]
      );

      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.');
        return;
      }

      await pool.query(
        `INSERT INTO automation_content_feedback
            (planning_item_id, automation_id, client_id, feedback_type, content_snapshot, platform, content_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          itemId,
          (item.metadata as any)?.automation_id || null,
          item.client_id,
          'like',
          item.content?.substring(0, 2000) || null,
          item.platform,
          item.content_type,
        ]
      );

      if (item.client_id && item.content) {
        await pool.query(
          `UPDATE client_content_library SET is_favorite = true WHERE client_id = $1 AND content = $2`,
          [item.client_id, item.content]
        );
      }

      await editMessage(
        chatId,
        messageId,
        `👍 <b>Feedback salvo: Gostei!</b>\n"${escapeHtml(item.title || '')}"`
      );
      break;
    }

    case 'fb_dislike': {
      const item = await queryOne<any>(
        `SELECT title, content, client_id, platform, content_type, metadata
           FROM planning_items WHERE id = $1`,
        [itemId]
      );

      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.');
        return;
      }

      await pool.query(
        `INSERT INTO automation_content_feedback
            (planning_item_id, automation_id, client_id, feedback_type, content_snapshot, platform, content_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          itemId,
          (item.metadata as any)?.automation_id || null,
          item.client_id,
          'dislike',
          item.content?.substring(0, 2000) || null,
          item.platform,
          item.content_type,
        ]
      );

      await pool.query(
        `UPDATE telegram_bot_config SET pending_feedback_item_id = $1, updated_at = NOW() WHERE id = 1`,
        [itemId]
      );

      await editMessage(
        chatId,
        messageId,
        `👎 <b>Feedback salvo: Não gostei</b>\n"${escapeHtml(item.title || '')}"`
      );
      await sendReply(
        chatId,
        `📝 O que não gostou nesse conteúdo? Responda para ajudar a IA a melhorar.\n\n<i>Envie /pular para registrar sem motivo.</i>`,
        undefined,
        { force_reply: true, selective: true }
      );
      break;
    }

    case 'fb_delete': {
      const item = await queryOne<any>(`SELECT * FROM planning_items WHERE id = $1`, [itemId]);
      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.');
        return;
      }

      await pool.query(
        `INSERT INTO automation_content_feedback
            (planning_item_id, automation_id, client_id, feedback_type, content_snapshot, platform, content_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          itemId,
          (item.metadata as any)?.automation_id || null,
          item.client_id,
          'delete',
          item.content?.substring(0, 2000) || null,
          item.platform,
          item.content_type,
        ]
      );

      await editMessage(chatId, messageId, `🗑️ <b>Apagando e regenerando...</b>`);

      if (item.client_id && item.content) {
        await pool.query(
          `DELETE FROM client_content_library WHERE client_id = $1 AND content = $2`,
          [item.client_id, item.content]
        );
      }

      try {
        const regenResponse = await callInternalHandler(req, 'unified-content-api', {
          brief: item.title,
          clientId: item.client_id,
          formatType: item.content_type || 'tweet',
        });

        if (regenResponse.ok) {
          const result = await regenResponse.json();
          const newContent = result.content || result.text;

          if (newContent) {
            await pool.query(
              `UPDATE planning_items
                  SET content = $1, status = 'idea', metadata = $2::jsonb
                WHERE id = $3`,
              [
                newContent,
                JSON.stringify({
                  ...((item.metadata as any) || {}),
                  regenerated_from_feedback: true,
                  previous_content_deleted: true,
                }),
                itemId,
              ]
            );

            const preview = newContent.substring(0, 800);
            await sendReply(
              chatId,
              `🔄 <b>Conteúdo regenerado!</b>\n\n<pre>${escapeHtml(preview)}</pre>`,
              {
                inline_keyboard: [
                  [
                    { text: '👍 Gostei', callback_data: `fb_like:${itemId}` },
                    { text: '👎 Não gostei', callback_data: `fb_dislike:${itemId}` },
                  ],
                  [
                    { text: '📝 Publicar agora', callback_data: `publish:${itemId}` },
                    { text: '🗑️ Apagar + Refazer', callback_data: `fb_delete:${itemId}` },
                  ],
                ],
              }
            );
          } else {
            await sendReply(chatId, '⚠️ Regeneração retornou sem conteúdo.');
          }
        } else {
          const errText = await regenResponse.text();
          await sendReply(chatId, `⚠️ Erro ao regenerar: ${errText.substring(0, 200)}`);
        }
      } catch (err: any) {
        await sendReply(chatId, `⚠️ Erro: ${err?.message || 'desconhecido'}`);
      }
      break;
    }

    default:
      await sendReply(chatId, `❓ Ação desconhecida: ${action}`);
  }
}

// =====================================================
// Handle text messages
// =====================================================
async function handleMessage(message: any) {
  const chatId = message.chat.id;
  const text = message.text;
  if (!text) return;

  const pool = getPool();
  const config = await queryOne<any>(
    `SELECT pending_rejection_item_id, pending_feedback_item_id, active_client_id
       FROM telegram_bot_config WHERE id = 1`
  );

  // Pending feedback reason (from fb_dislike)
  if (config?.pending_feedback_item_id && text !== '/pular') {
    const feedbackItemId = config.pending_feedback_item_id;
    const feedbacks = await query<any>(
      `SELECT id FROM automation_content_feedback
        WHERE planning_item_id = $1 AND feedback_type = 'dislike'
        ORDER BY created_at DESC LIMIT 1`,
      [feedbackItemId]
    );

    if (feedbacks.length > 0) {
      await pool.query(
        `UPDATE automation_content_feedback SET feedback_reason = $1 WHERE id = $2`,
        [text, feedbacks[0].id]
      );
    }

    await pool.query(
      `UPDATE telegram_bot_config SET pending_feedback_item_id = NULL, updated_at = NOW() WHERE id = 1`
    );
    await sendReply(chatId, `📝 Feedback detalhado salvo! A IA vai usar isso para melhorar.`);
    return;
  }

  if (text === '/pular' && config?.pending_feedback_item_id) {
    await pool.query(
      `UPDATE telegram_bot_config SET pending_feedback_item_id = NULL, updated_at = NOW() WHERE id = 1`
    );
    await sendReply(chatId, `✅ Feedback registrado sem motivo.`);
    return;
  }

  // Pending rejection feedback
  if (config?.pending_rejection_item_id && text !== '/pular') {
    const itemId = config.pending_rejection_item_id;
    const item = await queryOne<any>(`SELECT metadata FROM planning_items WHERE id = $1`, [itemId]);
    const currentMetadata = (item?.metadata as Record<string, unknown>) || {};

    await pool.query(
      `UPDATE planning_items SET metadata = $1::jsonb WHERE id = $2`,
      [
        JSON.stringify({
          ...currentMetadata,
          rejection_reason: text,
          rejected_at: new Date().toISOString(),
        }),
        itemId,
      ]
    );

    await pool.query(
      `UPDATE telegram_bot_config SET pending_rejection_item_id = NULL, updated_at = NOW() WHERE id = 1`
    );
    await sendReply(chatId, `📝 Feedback salvo! Obrigado.`);
    return;
  }

  if (text === '/pular' && config?.pending_rejection_item_id) {
    await pool.query(
      `UPDATE telegram_bot_config SET pending_rejection_item_id = NULL, updated_at = NOW() WHERE id = 1`
    );
    await sendReply(chatId, `✅ Reprovado sem feedback.`);
    return;
  }

  // /start command
  if (text === '/start') {
    await pool.query(`UPDATE telegram_bot_config SET chat_id = $1, updated_at = NOW() WHERE id = 1`, [
      chatId,
    ]);
    await sendReply(
      chatId,
      `👋 <b>kAI Bot ativado!</b>\n\nSeu chat_id (${chatId}) foi salvo.\n\nComandos:\n/pendentes — Ver itens pendentes\n/status — Status geral\n/aprovar_todos — Aprovar todos pendentes\n/clientes — Listar e trocar cliente ativo\n\n💬 Envie qualquer mensagem para conversar com o kAI!`
    );
    return;
  }

  // /clientes command
  if (text === '/clientes' || text?.startsWith('/cliente ')) {
    if (text.startsWith('/cliente ')) {
      const clientName = text.replace('/cliente ', '').trim();
      const clients = await query<any>(
        `SELECT id, name FROM clients WHERE name ILIKE $1 LIMIT 1`,
        [`%${clientName}%`]
      );

      if (clients.length > 0) {
        await pool.query(
          `UPDATE telegram_bot_config SET active_client_id = $1, updated_at = NOW() WHERE id = 1`,
          [clients[0].id]
        );
        await sendReply(chatId, `✅ Cliente ativo: <b>${escapeHtml(clients[0].name)}</b>`);
      } else {
        await sendReply(chatId, `❌ Cliente "${escapeHtml(clientName)}" não encontrado.`);
      }
      return;
    }

    const clients = await query<any>(`SELECT id, name FROM clients ORDER BY name LIMIT 20`);

    if (clients.length === 0) {
      await sendReply(chatId, '❌ Nenhum cliente cadastrado.');
      return;
    }

    let msg = '📋 <b>Clientes disponíveis:</b>\n\n';
    for (const c of clients) {
      const active = config?.active_client_id === c.id ? ' ✅' : '';
      msg += `• <b>${escapeHtml(c.name)}</b>${active}\n`;
    }
    msg += '\n💡 Use <code>/cliente Nome</code> para trocar.';
    await sendReply(chatId, msg);
    return;
  }

  // /pendentes
  if (text === '/pendentes') {
    const items = await query<any>(
      `SELECT pi.id, pi.title, pi.platform, pi.content_type, pi.created_at, c.name as client_name
         FROM planning_items pi
         LEFT JOIN clients c ON c.id = pi.client_id
        WHERE pi.status = 'idea'
        ORDER BY pi.created_at DESC LIMIT 10`
    );

    if (items.length === 0) {
      await sendReply(chatId, '✅ Nenhum item pendente!');
      return;
    }

    await sendReply(chatId, `📋 <b>${items.length} itens pendentes:</b>`);

    for (const item of items) {
      const platformLabel = item.platform || item.content_type || '';
      const title = item.title?.substring(0, 80) || 'Sem título';
      await sendReply(
        chatId,
        `📌 <b>${escapeHtml(title)}</b>\n${
          item.client_name ? `👤 ${escapeHtml(item.client_name)} · ` : ''
        }${platformLabel}`,
        {
          inline_keyboard: [
            [
              { text: '✅ Aprovar', callback_data: `approve:${item.id}` },
              { text: '❌ Reprovar', callback_data: `reject:${item.id}` },
            ],
          ],
        }
      );
    }
    return;
  }

  // /aprovar_todos
  if (text === '/aprovar_todos') {
    const items = await query<any>(
      `SELECT id, title, workspace_id FROM planning_items WHERE status = 'idea'`
    );

    if (items.length === 0) {
      await sendReply(chatId, '✅ Nenhum item pendente para aprovar!');
      return;
    }

    const workspaceId = items[0].workspace_id;
    const approvedColumn = await queryOne<any>(
      `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'approved' LIMIT 1`,
      [workspaceId]
    );
    const ids = items.map((i: any) => i.id);

    if (approvedColumn) {
      await pool.query(
        `UPDATE planning_items SET status = 'approved', column_id = $1 WHERE id = ANY($2::uuid[])`,
        [approvedColumn.id, ids]
      );
    } else {
      await pool.query(`UPDATE planning_items SET status = 'approved' WHERE id = ANY($1::uuid[])`, [
        ids,
      ]);
    }

    await sendReply(chatId, `✅ <b>${items.length} itens aprovados em lote!</b>`);
    return;
  }

  // /status
  if (text === '/status') {
    const pendingRow = await queryOne<any>(
      `SELECT COUNT(*)::int as c FROM planning_items WHERE status = 'idea'`
    );
    const approvedRow = await queryOne<any>(
      `SELECT COUNT(*)::int as c FROM planning_items WHERE status = 'approved'`
    );
    const today = new Date().toISOString().split('T')[0];
    const publishedRow = await queryOne<any>(
      `SELECT COUNT(*)::int as c FROM planning_items WHERE status = 'published' AND updated_at >= $1`,
      [today]
    );

    await sendReply(
      chatId,
      `📊 <b>Status:</b>\n\n📝 Pendentes: ${pendingRow?.c || 0}\n✅ Aprovados: ${
        approvedRow?.c || 0
      }\n📤 Publicados hoje: ${publishedRow?.c || 0}`
    );
    return;
  }

  // Fallback
  await sendReply(
    chatId,
    `👋 Use os comandos disponíveis:\n\n/pendentes — Ver itens pendentes\n/status — Status geral\n/aprovar_todos — Aprovar todos\n/clientes — Listar clientes\n\nOu use os botões de aprovação nas notificações!`
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return res.status(503).json({
      error: 'Telegram integration not configured',
      missing_env: missing,
      hint: 'Add TELEGRAM_BOT_TOKEN env var in Vercel and redeploy',
    });
  }

  const startTime = Date.now();
  const pool = getPool();

  let totalProcessed = 0;

  const state = await queryOne<any>(
    `SELECT update_offset, chat_id, is_active FROM telegram_bot_config WHERE id = 1 LIMIT 1`
  );

  if (!state) {
    return res.status(500).json({ error: 'No telegram_bot_config row (id=1)' });
  }

  if (!state.is_active) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'Bot inactive' });
  }

  // Delete any existing webhook to avoid 409 conflict with getUpdates
  try {
    const webhookRes = await fetch(tgUrl('deleteWebhook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const webhookData = await webhookRes.json().catch(() => ({}));
    console.log('[telegram-poll] deleteWebhook result:', JSON.stringify(webhookData));
  } catch (e) {
    console.warn('[telegram-poll] deleteWebhook failed:', e);
  }

  let currentOffset = state.update_offset;

  // Short non-blocking poll to clear stale connections
  try {
    await fetch(tgUrl('getUpdates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset: currentOffset, timeout: 0 }),
    });
  } catch {}

  await new Promise((r) => setTimeout(r, 1000));

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(25, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    try {
      const response = await fetch(tgUrl('getUpdates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: currentOffset,
          timeout,
          allowed_updates: ['message', 'callback_query'],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if ((data as any)?.error_code === 409) {
          console.warn('[telegram-poll] 409 conflict, waiting 3s...');
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        console.error('getUpdates failed:', data);
        break;
      }

      const updates = (data as any).result ?? [];
      if (updates.length === 0) continue;

      for (const update of updates) {
        try {
          if (update.callback_query) {
            await handleCallback(update.callback_query, req);
          } else if (update.message) {
            await handleMessage(update.message);
          }
          totalProcessed++;
        } catch (err) {
          console.error('Error processing update:', err);
        }
      }

      // Store raw updates
      for (const u of updates) {
        try {
          await pool.query(
            `INSERT INTO telegram_messages (update_id, chat_id, message_text, callback_data, raw_update)
             VALUES ($1, $2, $3, $4, $5::jsonb)
             ON CONFLICT (update_id) DO NOTHING`,
            [
              u.update_id,
              u.callback_query?.message?.chat?.id || u.message?.chat?.id || 0,
              u.message?.text || null,
              u.callback_query?.data || null,
              JSON.stringify(u),
            ]
          );
        } catch (e) {
          console.warn('telegram_messages insert failed', e);
        }
      }

      const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
      await pool.query(
        `UPDATE telegram_bot_config SET update_offset = $1, updated_at = NOW() WHERE id = 1`,
        [newOffset]
      );
      currentOffset = newOffset;
    } catch (err) {
      console.error('Polling error:', err);
      break;
    }
  }

  return res
    .status(200)
    .json({ ok: true, processed: totalProcessed, finalOffset: currentOffset });
}
