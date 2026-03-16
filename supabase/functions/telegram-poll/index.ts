import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
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

  let currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
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

  if (!data) return;

  const [action, itemId] = data.split(':');

  // Answer callback to remove loading state
  await fetch(`${GATEWAY_URL}/answerCallbackQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ callback_query_id: callback.id }),
  }).then(r => r.text());

  if (!itemId) {
    await sendReply(chatId, '❌ ID do item não encontrado.', headers);
    return;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  switch (action) {
    case 'approve': {
      const { data: item } = await supabase
        .from('planning_items')
        .select('workspace_id, title, status')
        .eq('id', itemId)
        .single();

      if (!item) {
        await sendReply(chatId, '❌ Item não encontrado.', headers);
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

      await editMessage(chatId, messageId, `✅ <b>Aprovado!</b>\n"${item.title}"`, headers);
      break;
    }

    case 'reject': {
      const { data: item } = await supabase
        .from('planning_items')
        .select('title')
        .eq('id', itemId)
        .single();

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
        .single();

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
              .update({ body: newContent, status: 'idea' })
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
        .single();

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
            content: item.body,
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
      `👋 <b>kAI Bot ativado!</b>\n\nSeu chat_id (${chatId}) foi salvo.\n\nComandos:\n/pendentes — Ver itens pendentes com ações\n/status — Status geral\n/aprovar_todos — Aprovar todos pendentes\n\n💬 Envie qualquer mensagem para conversar com a IA!`, 
      headers
    );
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

    // Send each item as a separate message with action buttons
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

    // Get workspace's approved column
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

  // =====================================================
  // Content creation by text (intent detection)
  // =====================================================
  const createMatch = text.match(/^(?:cria|gera|escreve|faz|monte)\s+(?:um\s+)?(?:post|tweet|carrossel|reels?|conteúdo|texto)\s+(?:sobre\s+)?(.+?)(?:\s+para\s+(?:o\s+)?(.+))?$/i);
  
  if (createMatch) {
    const topic = createMatch[1]?.trim();
    const clientName = createMatch[2]?.trim();

    await sendReply(chatId, `🔄 <b>Criando conteúdo...</b>\n"${escapeHtml(topic)}"`, headers);

    try {
      let clientId: string | null = null;
      
      if (clientName) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')
          .ilike('name', `%${clientName}%`)
          .limit(1);
        
        if (clients && clients.length > 0) {
          clientId = clients[0].id;
        }
      }

      // If no client found, get first available
      if (!clientId) {
        const { data: firstClient } = await supabase
          .from('clients')
          .select('id')
          .limit(1)
          .single();
        clientId = firstClient?.id;
      }

      if (!clientId) {
        await sendReply(chatId, '❌ Nenhum cliente encontrado.', headers);
        return;
      }

      // Call unified-content-api to generate
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      
      const genResponse = await fetch(`${supabaseUrl}/functions/v1/unified-content-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brief: topic,
          clientId,
          formatType: 'post',
        }),
      });

      if (genResponse.ok) {
        const result = await genResponse.json();
        const content = result.content || result.text;

        if (content) {
          // Get workspace_id from client
          const { data: client } = await supabase
            .from('clients')
            .select('workspace_id, name')
            .eq('id', clientId)
            .single();

          // Get idea column
          const { data: ideaColumn } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('workspace_id', client.workspace_id)
            .eq('column_type', 'idea')
            .single();

          // Create planning item
          const { data: newItem } = await supabase
            .from('planning_items')
            .insert({
              title: topic,
              body: content,
              status: 'idea',
              client_id: clientId,
              workspace_id: client.workspace_id,
              column_id: ideaColumn?.id,
              content_type: 'post',
              source: 'telegram',
            })
            .select('id')
            .single();

          const preview = content.substring(0, 800);
          await sendReply(
            chatId,
            `✨ <b>Conteúdo criado!</b>\n👤 ${escapeHtml(client.name)}\n\n<pre>${escapeHtml(preview)}</pre>`,
            headers,
            {
              inline_keyboard: [
                [
                  { text: '✅ Aprovar', callback_data: `approve:${newItem?.id}` },
                  { text: '❌ Reprovar', callback_data: `reject:${newItem?.id}` },
                ],
                [
                  { text: '🔄 Regenerar', callback_data: `regen:${newItem?.id}` },
                  { text: '📝 Publicar', callback_data: `publish:${newItem?.id}` },
                ],
              ],
            }
          );
        } else {
          await sendReply(chatId, '⚠️ Geração retornou sem conteúdo.', headers);
        }
      } else {
        await sendReply(chatId, '❌ Erro ao gerar conteúdo.', headers);
      }
    } catch (err) {
      await sendReply(chatId, `❌ Erro: ${err instanceof Error ? err.message : 'desconhecido'}`, headers);
    }
    return;
  }

  // =====================================================
  // AI response for free text (via Lovable AI Gateway)
  // =====================================================
  try {
    await sendChatAction(chatId, 'typing', headers);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      await sendReply(chatId, '⚠️ IA não configurada.', headers);
      return;
    }

    // Get recent message history for context
    const { data: recentMessages } = await supabase
      .from('telegram_messages')
      .select('message_text, raw_update')
      .eq('chat_id', chatId)
      .order('update_id', { ascending: false })
      .limit(6);

    const history = (recentMessages || [])
      .reverse()
      .filter((m: any) => m.message_text)
      .map((m: any) => ({
        role: 'user' as const,
        content: m.message_text,
      }));

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é o kAI, assistente de marketing e conteúdo digital. Responda de forma concisa e útil em português brasileiro. 
Você pode ajudar com:
- Ideias de conteúdo
- Copywriting
- Estratégia de marketing
- Dúvidas sobre redes sociais
- Análise de tendências

Comandos disponíveis que o usuário pode usar:
/pendentes - Ver itens pendentes
/status - Status geral
/aprovar_todos - Aprovar todos pendentes

Para criar conteúdo, o usuário pode dizer "cria um post sobre X para o [cliente]".

Seja direto, criativo e profissional. Use emojis moderadamente.`,
          },
          ...history,
          { role: 'user', content: text },
        ],
        stream: false,
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content;
      
      if (reply) {
        // Telegram HTML: strip markdown, keep simple
        const cleanReply = reply
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/\*(.*?)\*/g, '<i>$1</i>')
          .replace(/```[\s\S]*?```/g, (m: string) => `<pre>${escapeHtml(m.replace(/```\w*\n?/g, '').replace(/```/g, ''))}</pre>`)
          .replace(/`(.*?)`/g, '<code>$1</code>');

        await sendReply(chatId, cleanReply.substring(0, 4000), headers);
      } else {
        await sendReply(chatId, '🤔 Não consegui gerar uma resposta. Tente novamente!', headers);
      }
    } else {
      const status = aiResponse.status;
      if (status === 429) {
        await sendReply(chatId, '⏳ Muitas requisições. Tente novamente em alguns segundos.', headers);
      } else if (status === 402) {
        await sendReply(chatId, '⚠️ Créditos de IA esgotados.', headers);
      } else {
        await sendReply(chatId, '❌ Erro ao consultar IA.', headers);
      }
    }
  } catch (err) {
    console.error('AI response error:', err);
    await sendReply(chatId, '❌ Erro ao processar sua mensagem.', headers);
  }
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

async function sendChatAction(
  chatId: number | string,
  action: string,
  headers: Record<string, string>,
) {
  await fetch(`${GATEWAY_URL}/sendChatAction`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
