import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
    if (!TELEGRAM_API_KEY) throw new Error('TELEGRAM_API_KEY is not configured');

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

    // Get chat_id from DB or request body
    const body = await req.json();
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
    } = body;

    // Get chat_id from config if not provided
    let chatId = overrideChatId;
    if (!chatId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const { createClient } = await import("npm:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: config } = await supabase
        .from('telegram_bot_config')
        .select('chat_id')
        .eq('id', 1)
        .single();
      
      chatId = config?.chat_id;
    }

    if (!chatId) {
      return new Response(JSON.stringify({ error: 'No chat_id configured. Send /start to the bot first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format message
    const platformEmoji: Record<string, string> = {
      twitter: '🐦',
      linkedin: '💼',
      instagram: '📸',
      threads: '🧵',
      tiktok: '🎵',
      blog: '📝',
      newsletter: '📧',
    };

    const emoji = platformEmoji[platform || ''] || '📋';
    const contentPreview = content ? content.substring(0, 800) : 'Sem conteúdo';
    
    const isPublished = body.published === true;
    const headerText = isPublished
      ? `${emoji} <b>✅ Conteúdo publicado automaticamente</b>`
      : `${emoji} <b>📋 Novo conteúdo para revisão</b>`;

    const publishedUrlsText = body.published_urls
      ? Object.entries(body.published_urls as Record<string, string>)
          .map(([p, url]) => `🔗 ${p}: ${url}`)
          .join('\n')
      : '';

    const messageText = [
      headerText,
      ``,
      `<b>Automação:</b> ${automation_name || 'N/A'}`,
      `<b>Cliente:</b> ${client_name || 'N/A'}`,
      `<b>Plataforma:</b> ${platform || 'N/A'}`,
      `<b>Tipo:</b> ${content_type || 'N/A'}`,
      ``,
      `<b>Título:</b> ${title || 'Sem título'}`,
      ``,
      `<pre>${escapeHtml(contentPreview)}</pre>`,
      publishedUrlsText ? `\n${publishedUrlsText}` : '',
      !isPublished ? `\n⬇️ <i>Escolha uma ação abaixo:</i>` : '',
    ].filter(Boolean).join('\n');

    // Inline keyboard — always show feedback buttons for published content
    const inlineKeyboard = isPublished
      ? {
          inline_keyboard: [
            [
              { text: '👍 Gostei', callback_data: `fb_like:${item_id}` },
              { text: '👎 Não gostei', callback_data: `fb_dislike:${item_id}` },
              { text: '🗑️ Apagar + Refazer', callback_data: `fb_delete:${item_id}` },
            ],
            [
              { text: '📋 Ver no painel', callback_data: `view:${item_id}` },
            ],
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

    const headers = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': TELEGRAM_API_KEY,
      'Content-Type': 'application/json',
    };

    let sentMessage;

    // If there's an image, send as photo with caption
    if (image_url) {
      // Caption has a 1024 char limit, so truncate
      const caption = messageText.length > 1024 
        ? messageText.substring(0, 1000) + '...'
        : messageText;

      const photoResponse = await fetch(`${GATEWAY_URL}/sendPhoto`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chat_id: chatId,
          photo: image_url,
          caption,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard,
        }),
      });

      const photoData = await photoResponse.json();
      
      if (!photoResponse.ok) {
        console.error('Failed to send photo, falling back to text:', photoData);
        // Fallback to text message
        sentMessage = await sendTextMessage(chatId, messageText, inlineKeyboard, headers);
      } else {
        sentMessage = photoData;
      }
    } else {
      sentMessage = await sendTextMessage(chatId, messageText, inlineKeyboard, headers);
    }

    console.log(`✅ Telegram notification sent for item ${item_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: sentMessage?.result?.message_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in telegram-notify:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendTextMessage(
  chatId: number | string,
  text: string,
  replyMarkup: any,
  headers: Record<string, string>,
) {
  const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed [${response.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
