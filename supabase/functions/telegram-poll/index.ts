import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

serve(async () => {
  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY is not configured');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const headers = {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': TELEGRAM_API_KEY,
    'Content-Type': 'application/json',
  };

  let totalProcessed = 0;

  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_config')
    .select('update_offset, chat_id, is_active')
    .eq('id', 1)
    .single();

  if (stateErr || !state) {
    return new Response(JSON.stringify({ error: stateErr?.message || 'No config' }), { status: 500 });
  }

  if (!state.is_active) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'Bot inactive' }));
  }

  // Delete any existing webhook to avoid 409 conflict with getUpdates
  try {
    const webhookRes = await fetch(`${GATEWAY_URL}/deleteWebhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const webhookData = await webhookRes.json();
    console.log('[telegram-poll] deleteWebhook result:', JSON.stringify(webhookData));
  } catch (e) {
    console.warn('[telegram-poll] deleteWebhook failed:', e);
  }

  let currentOffset = state.update_offset;

  // First, do a short non-blocking poll (timeout=0) to clear any stale connections
  try {
    await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ offset: currentOffset, timeout: 0 }),
    });
  } catch (_) { /* ignore */ }

  // Small delay to let Telegram release the connection
  await new Promise(r => setTimeout(r, 1000));

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(25, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    try {
      const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          offset: currentOffset,
          timeout,
          allowed_updates: ['message', 'callback_query'],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data?.error_code === 409) {
          console.warn('[telegram-poll] 409 conflict, waiting 3s and retrying...');
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        console.error('getUpdates failed:', data);
        break;
      }

      const updates = data.result ?? [];
      if (updates.length === 0) continue;

      for (const update of updates) {
        try {
          if (update.callback_query) {
            await handleCallback(supabase, update.callback_query, headers, state.chat_id);
          } else if (update.message) {
            await handleMessage(supabase, update.message, headers);
          }
          totalProcessed++;
        } catch (err) {
          console.error('Error processing update:', err);
        }
      }

      // Store raw updates
      const rows = updates.map((u: any) => ({
        update_id: u.update_id,
        chat_id: u.callback_query?.message?.chat?.id || u.message?.chat?.id || 0,
        message_text: u.message?.text || null,
        callback_data: u.callback_query?.data || null,
        raw_update: u,
      }));

      if (rows.length > 0) {
        await supabase
          .from('telegram_messages')
          .upsert(rows, { onConflict: 'update_id' });
      }

      const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
      await supabase
        .from('telegram_bot_config')
        .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
        .eq('id', 1);
      currentOffset = newOffset;

    } catch (err) {
      console.error('Polling error:', err);
      break;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }));
});

// =====================================================
// Handle callback queries (button presses)
// =====================================================
async function handleCallback(
  supabase: any,
  callback: any,
  headers: Record<string, string>,
  configChatId: number | null,
) {
  const data = callback.data;
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;

  console.log(`[telegram-poll] Callback received: data="${data}", chatId=${chatId}, messageId=${messageId}`);

  if (!data) return;

  // Support both "action:uuid" format - split only on first ':'
  const colonIndex = data.indexOf(':');
  const action = colonIndex > -1 ? data.substring(0, colonIndex) : data;
  const itemId = colonIndex > -1 ? data.substring(colonIndex + 1) : null;

  console.log(`[telegram-poll] Parsed action="${action}", itemId="${itemId}"`);

  // Answer callback to remove loading state
  await fetch(`${GATEWAY_URL}/answerCallbackQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ callback_query_id: callback.id }),
  }).then(r => r.text());

  if (!itemId || itemId === 'undefined' || itemId === 'null') {
    await sendReply(chatId, '❌ ID do item não encontrado no botão. Tente via /pendentes.', headers);
    return;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  switch (action) {
    case 'approve': {
      console.log(`[telegram-poll] Querying planning_items for id="${itemId}"`);
      const { data: item, error: itemError } = await supabase
        .from('planning_items')
        .select('workspace_id, title, status, client_id, content, media_urls, metadata, content_type, platform')
        .eq('id', itemId)
        .maybeSingle();

      console.log(`[telegram-poll] Query result: item=${item ? 'found' : 'null'}, error=${itemError ? JSON.stringify(itemError) : 'none'}`);

      if (itemError) {
        await sendReply(chatId, `❌ Erro ao buscar item para aprovação.`, headers);
        return;
      }

      if (!item) {
        await sendReply(chatId, `❌ Item não encontrado (ID: ${itemId.substring(0, 8)}...). Pode ter sido excluído.`, headers);
        return;
      }

      const { data: approvedColumn } = await supabase
        .from('kanban_columns')
        .select('id')
        .eq('workspace_id', item.workspace_id)
        .eq('column_type', 'approved')
        .single();

      const updateData: Record<string, unknown> = { status: 'approved' };
      if (approvedColumn) {
        updateData.column_id = approvedColumn.id;
      }

      await supabase
        .from('planning_items')
        .update(updateData)
        .eq('id', itemId);

      const itemMeta = (item.metadata as any) || {};

      // If this item was flagged for auto-publish on approve, trigger publishing now
      if (itemMeta.auto_publish_on_approve && item.client_id) {
        await editMessage(chatId, messageId, `✅ <b>Aprovado!</b> Publicando...\n"${item.title}"`, headers);

        const targetPlatforms: string[] = itemMeta.target_platforms || [item.platform].filter(Boolean);
        const generatedContent = item.content || '';
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        let publishSuccess = false;

        for (const targetPlatform of targetPlatforms) {
          try {
            const publishBody: Record<string, unknown> = {
              clientId: item.client_id,
              platform: targetPlatform,
              content: generatedContent,
              planningItemId: itemId,
            };

            // Add thread items if available
            if (item.content_type === 'thread' && itemMeta.thread_tweets?.length > 0) {
              publishBody.threadItems = itemMeta.thread_tweets.map((t: any) => ({
                text: t.text,
                media_urls: t.media_urls || [],
              }));
            }

            // Add carousel media if available
            if (item.content_type === 'carousel' && itemMeta.carousel_slides?.length > 0) {
              const carouselMedia: { url: string; type: string }[] = [];
              for (const slide of itemMeta.carousel_slides) {
                if (slide.media_urls?.length > 0) {
                  for (const url of slide.media_urls) {
                    carouselMedia.push({ url, type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image' });
                  }
                }
              }
              if (carouselMedia.length > 0) publishBody.mediaItems = carouselMedia;
            }

            // Regular media
            if (!publishBody.threadItems && !publishBody.mediaItems && item.media_urls?.length > 0) {
              publishBody.mediaItems = item.media_urls.map((url: string) => ({
                url,
                type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
              }));
            }

            const publishResponse = await fetch(`${supabaseUrl}/functions/v1/late-post`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(publishBody),
            });

            if (publishResponse.ok) {
              const publishResult = await publishResponse.json();
              const externalPostId = publishResult.externalId || publishResult.postId;

              if (publishResult.success && externalPostId) {
                publishSuccess = true;
                await supabase
                  .from('planning_items')
                  .update({
                    status: 'published',
                    external_post_id: externalPostId,
                    metadata: {
                      ...itemMeta,
                      auto_published: true,
                      published_at: new Date().toISOString(),
                      late_post_id: externalPostId,
                      pending_telegram_approval: false,
                      published_platforms: [...(itemMeta.published_platforms || []), targetPlatform],
                    },
                  })
                  .eq('id', itemId);

                const postUrl = publishResult.postUrl || publishResult.url || '';
                const urlText = postUrl ? `\n🔗 ${postUrl}` : '';
                await sendReply(chatId, `📤 <b>Publicado em ${targetPlatform}!</b>${urlText}`, headers);
              } else {
                await sendReply(chatId, `⚠️ ${targetPlatform}: ${publishResult.error || 'Falha na publicação'}`, headers);
              }
            } else {
              const errText = await publishResponse.text();
              await sendReply(chatId, `❌ ${targetPlatform}: ${errText.substring(0, 200)}`, headers);
            }
          } catch (err) {
            await sendReply(chatId, `❌ ${targetPlatform}: ${err instanceof Error ? err.message : 'erro'}`, headers);
          }
        }

        if (!publishSuccess) {
          await sendReply(chatId, `⚠️ Aprovado mas publicação falhou. Tente via /pendentes ou pelo painel.`, headers);
        }
      } else {
        await editMessage(chatId, messageId, `✅ <b>Aprovado!</b>\n"${item.title}"`, headers);
      }
      break;
    }

    case 'reject': {
      const { data: item } = await supabase
        .from('planning_items')
        .select('title')
        .eq('id', itemId)
        .maybeSingle();

      // Ask for feedback with forceReply
      await editMessage(chatId, messageId, `❌ <b>Reprovado.</b>\n"${item?.title || itemId}"`, headers);

      // Store pending rejection to capture feedback
      await supabase
        .from('telegram_bot_config')
        .update({ 
          pending_rejection_item_id: itemId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      await sendReply(
        chatId, 
        `📝 Qual o motivo da reprovação de "<b>${escapeHtml(item?.title || 'item')}</b>"?\n\n<i>Responda com o feedback ou envie /pular para reprovar sem motivo.</i>`,
        headers,
        undefined,
        { force_reply: true, selective: true }
      );

      // Mark as rejected immediately
      await supabase
        .from('planning_items')
        .update({ status: 'rejected' })
        .eq('id', itemId);

      break;
    }

    case 'regen': {
      await editMessage(chatId, messageId, `🔄 <b>Regenerando conteúdo...</b>`, headers);

      const { data: item } = await supabase
        .from('planning_items')
        .select('*, client:clients(name)')
        .eq('id', itemId)
        .maybeSingle();

      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.', headers);
        return;
      }

      try {
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const regenResponse = await fetch(`${supabaseUrl}/functions/v1/unified-content-api`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brief: item.title,
            clientId: item.client_id,
            formatType: item.content_type || 'tweet',
          }),
        });

        if (regenResponse.ok) {
          const result = await regenResponse.json();
          const newContent = result.content || result.text;

          if (newContent) {
            await supabase
              .from('planning_items')
              .update({ content: newContent, status: 'idea' })
              .eq('id', itemId);

            const preview = newContent.substring(0, 800);
            await sendReply(chatId, 
              `🔄 <b>Conteúdo regenerado!</b>\n\n<pre>${escapeHtml(preview)}</pre>`, 
              headers,
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
            await sendReply(chatId, '⚠️ Regeneração retornou sem conteúdo.', headers);
          }
        } else {
          const errText = await regenResponse.text();
          await sendReply(chatId, `⚠️ Erro ao regenerar: ${errText.substring(0, 200)}`, headers);
        }
      } catch (err) {
        await sendReply(chatId, `⚠️ Erro: ${err instanceof Error ? err.message : 'desconhecido'}`, headers);
      }
      break;
    }

    case 'publish': {
      await editMessage(chatId, messageId, `📝 <b>Publicando...</b>`, headers);

      const { data: item } = await supabase
        .from('planning_items')
        .select('*, client:clients(name)')
        .eq('id', itemId)
        .maybeSingle();

      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.', headers);
        return;
      }

      try {
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const platform = item.platform || (item.metadata as any)?.target_platforms?.[0] || 'twitter';
        
        const publishResponse = await fetch(`${supabaseUrl}/functions/v1/late-post`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: item.client_id,
            platform,
            content: item.content,
            planningItemId: itemId,
            mediaItems: item.media_urls?.map((url: string) => ({
              url,
              type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
            })) || [],
          }),
        });

        if (publishResponse.ok) {
          const result = await publishResponse.json();
          if (result.success) {
            const postUrl = result.postUrl || result.url || '';
            const urlText = postUrl ? `\n🔗 ${postUrl}` : '';
            await sendReply(chatId, `✅ <b>Publicado com sucesso!</b> Plataforma: ${platform}${urlText}`, headers);
          } else {
            await sendReply(chatId, `⚠️ Late API retornou: ${result.error || JSON.stringify(result).substring(0, 200)}`, headers);
          }
        } else {
          const errText = await publishResponse.text();
          await sendReply(chatId, `❌ Erro ao publicar: ${errText.substring(0, 200)}`, headers);
        }
      } catch (err) {
        await sendReply(chatId, `❌ Erro: ${err instanceof Error ? err.message : 'desconhecido'}`, headers);
      }
      break;
    }

    default:
      await sendReply(chatId, `❓ Ação desconhecida: ${action}`, headers);
  }
}

// =====================================================
// Handle text messages
// =====================================================
async function handleMessage(
  supabase: any,
  message: any,
  headers: Record<string, string>,
) {
  const chatId = message.chat.id;
  const text = message.text;

  if (!text) return;

  // Check for pending rejection feedback
  const { data: config } = await supabase
    .from('telegram_bot_config')
    .select('pending_rejection_item_id')
    .eq('id', 1)
    .single();

  if (config?.pending_rejection_item_id && text !== '/pular') {
    const itemId = config.pending_rejection_item_id;
    
    // Save feedback to planning item metadata
    const { data: item } = await supabase
      .from('planning_items')
      .select('metadata')
      .eq('id', itemId)
      .single();

    const currentMetadata = (item?.metadata as Record<string, unknown>) || {};
    await supabase
      .from('planning_items')
      .update({ 
        metadata: { ...currentMetadata, rejection_reason: text, rejected_at: new Date().toISOString() },
      })
      .eq('id', itemId);

    // Clear pending
    await supabase
      .from('telegram_bot_config')
      .update({ pending_rejection_item_id: null, updated_at: new Date().toISOString() })
      .eq('id', 1);

    await sendReply(chatId, `📝 Feedback salvo! Obrigado.`, headers);
    return;
  }

  // Clear pending rejection on /pular
  if (text === '/pular' && config?.pending_rejection_item_id) {
    await supabase
      .from('telegram_bot_config')
      .update({ pending_rejection_item_id: null, updated_at: new Date().toISOString() })
      .eq('id', 1);
    await sendReply(chatId, `✅ Reprovado sem feedback.`, headers);
    return;
  }

  // /start command
  if (text === '/start') {
    await supabase
      .from('telegram_bot_config')
      .update({ chat_id: chatId, updated_at: new Date().toISOString() })
      .eq('id', 1);

    await sendReply(chatId, 
      `👋 <b>kAI Bot ativado!</b>\n\nSeu chat_id (${chatId}) foi salvo.\n\nComandos:\n/pendentes — Ver itens pendentes\n/status — Status geral\n/aprovar_todos — Aprovar todos pendentes\n/clientes — Listar e trocar cliente ativo\n\n💬 Envie qualquer mensagem para conversar com o kAI!`, 
      headers
    );
    return;
  }

  // /clientes command — list and switch active client
  if (text === '/clientes' || text?.startsWith('/cliente ')) {
    if (text.startsWith('/cliente ')) {
      const clientName = text.replace('/cliente ', '').trim();
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', `%${clientName}%`)
        .limit(1);

      if (clients && clients.length > 0) {
        await supabase
          .from('telegram_bot_config')
          .update({ active_client_id: clients[0].id, updated_at: new Date().toISOString() })
          .eq('id', 1);
        await sendReply(chatId, `✅ Cliente ativo: <b>${escapeHtml(clients[0].name)}</b>`, headers);
      } else {
        await sendReply(chatId, `❌ Cliente "${escapeHtml(clientName)}" não encontrado.`, headers);
      }
      return;
    }

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .limit(20);

    const { data: config } = await supabase
      .from('telegram_bot_config')
      .select('active_client_id')
      .eq('id', 1)
      .single();

    if (!clients || clients.length === 0) {
      await sendReply(chatId, '❌ Nenhum cliente cadastrado.', headers);
      return;
    }

    let msg = '📋 <b>Clientes disponíveis:</b>\n\n';
    for (const c of clients) {
      const active = config?.active_client_id === c.id ? ' ✅' : '';
      msg += `• <b>${escapeHtml(c.name)}</b>${active}\n`;
    }
    msg += '\n💡 Use <code>/cliente Nome</code> para trocar.';
    await sendReply(chatId, msg, headers);
    return;
  }

  // /pendentes command — now with inline buttons
  if (text === '/pendentes') {
    const { data: items } = await supabase
      .from('planning_items')
      .select('id, title, platform, content_type, created_at, client:clients(name)')
      .eq('status', 'idea')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!items || items.length === 0) {
      await sendReply(chatId, '✅ Nenhum item pendente!', headers);
      return;
    }

    await sendReply(chatId, `📋 <b>${items.length} itens pendentes:</b>`, headers);

    for (const item of items) {
      const clientName = (item.client as any)?.name || '';
      const platformLabel = item.platform || item.content_type || '';
      const title = item.title?.substring(0, 80) || 'Sem título';

      await sendReply(
        chatId,
        `📌 <b>${escapeHtml(title)}</b>\n${clientName ? `👤 ${escapeHtml(clientName)} · ` : ''}${platformLabel}`,
        headers,
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

  // /aprovar_todos command
  if (text === '/aprovar_todos') {
    const { data: items } = await supabase
      .from('planning_items')
      .select('id, title, workspace_id')
      .eq('status', 'idea');

    if (!items || items.length === 0) {
      await sendReply(chatId, '✅ Nenhum item pendente para aprovar!', headers);
      return;
    }

    const workspaceId = items[0].workspace_id;
    const { data: approvedColumn } = await supabase
      .from('kanban_columns')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('column_type', 'approved')
      .single();

    const updateData: Record<string, unknown> = { status: 'approved' };
    if (approvedColumn) updateData.column_id = approvedColumn.id;

    const ids = items.map((i: any) => i.id);
    await supabase
      .from('planning_items')
      .update(updateData)
      .in('id', ids);

    await sendReply(chatId, `✅ <b>${items.length} itens aprovados em lote!</b>`, headers);
    return;
  }

  // /status command
  if (text === '/status') {
    const { count: pendingCount } = await supabase
      .from('planning_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'idea');

    const { count: approvedCount } = await supabase
      .from('planning_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: publishedToday } = await supabase
      .from('planning_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('updated_at', new Date().toISOString().split('T')[0]);

    await sendReply(chatId, 
      `📊 <b>Status:</b>\n\n📝 Pendentes: ${pendingCount || 0}\n✅ Aprovados: ${approvedCount || 0}\n📤 Publicados hoje: ${publishedToday || 0}`,
      headers
    );
    return;
  }

  // Any other message — inform user about available commands
  await sendReply(chatId, 
    `👋 Use os comandos disponíveis:\n\n/pendentes — Ver itens pendentes\n/status — Status geral\n/aprovar_todos — Aprovar todos\n/clientes — Listar clientes\n\nOu use os botões de aprovação nas notificações!`,
    headers
  );
}

// =====================================================
// Helpers
// =====================================================
async function sendReply(
  chatId: number | string,
  text: string,
  headers: Record<string, string>,
  replyMarkup?: any,
  forceReplyMarkup?: any,
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  } else if (forceReplyMarkup) {
    body.reply_markup = forceReplyMarkup;
  }

  const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('sendReply failed:', data);
  }
  return data;
}

async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  headers: Record<string, string>,
) {
  const response = await fetch(`${GATEWAY_URL}/editMessageText`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('editMessage failed:', data);
  }
  return data;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
