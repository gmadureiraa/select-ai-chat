import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
  const signedOAuthParams = { ...oauthParams, oauth_signature: signature };

  return "OAuth " + Object.entries(signedOAuthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

interface ReplyRequest {
  clientId: string;
  opportunityId: string;
  replyText?: string;
  tone?: 'insightful' | 'bold' | 'supportive';
  generateOnly?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { clientId, opportunityId, replyText, tone = 'insightful', generateOnly = false } = await req.json() as ReplyRequest;

    if (!clientId || !opportunityId) {
      return new Response(JSON.stringify({ error: 'clientId and opportunityId are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get opportunity
    const { data: opportunity, error: oppError } = await supabase
      .from('engagement_opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (oppError || !opportunity) {
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get client context
    const { data: client } = await supabase
      .from('clients')
      .select('name, identity_guide, description')
      .eq('id', clientId)
      .single();

    let finalReplyText = replyText || '';

    // Generate reply with AI if no text provided
    if (!finalReplyText) {
      const toneInstructions: Record<string, string> = {
        insightful: 'Tom analítico e perspicaz. Adicione uma observação inteligente ou dado relevante. Mostre expertise.',
        bold: 'Tom ousado e direto. Tenha uma opinião forte. Seja provocativo mas respeitoso.',
        supportive: 'Tom construtivo e encorajador. Concorde e adicione valor. Seja genuíno.',
      };

      const prompt = `Gere uma reply para o tweet abaixo mantendo o tom de voz do cliente.

TWEET ORIGINAL:
@${opportunity.author_username}: "${opportunity.tweet_text}"

CLIENTE: ${client?.name || 'Unknown'}
${client?.identity_guide ? `GUIA DE IDENTIDADE (resumo): ${client.identity_guide.substring(0, 500)}` : ''}

TOM ESCOLHIDO: ${tone.toUpperCase()}
${toneInstructions[tone]}

REGRAS:
1. Máximo 280 caracteres
2. Seja natural, NÃO pareça bot
3. Agregue valor real à conversa
4. NÃO use hashtags gratuitas
5. NÃO comece com "Ótimo ponto!" ou frases genéricas
6. Mantenha a voz/personalidade do cliente

Retorne APENAS o texto da reply, sem aspas.`;

      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiKey) {
        return new Response(JSON.stringify({ error: 'AI key not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        return new Response(JSON.stringify({ error: 'AI generation failed', details: errorText }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const aiResult = await aiResponse.json();
      finalReplyText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
      // Ensure under 280 chars
      if (finalReplyText.length > 280) {
        finalReplyText = finalReplyText.substring(0, 277) + '...';
      }
    }

    // If generateOnly, return the text without posting
    if (generateOnly) {
      return new Response(JSON.stringify({
        success: true,
        replyText: finalReplyText,
        generateOnly: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Post the reply
    const { data: credentials } = await supabase
      .from('client_social_credentials_decrypted')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'twitter')
      .single();

    if (!credentials) {
      return new Response(JSON.stringify({ error: 'Twitter credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { api_key, api_secret, access_token, access_token_secret } = credentials;
    const tweetUrl = 'https://api.x.com/2/tweets';
    const oauthHeader = generateOAuthHeader('POST', tweetUrl, api_key, api_secret, access_token, access_token_secret);

    const tweetPayload = {
      text: finalReplyText,
      reply: { in_reply_to_tweet_id: opportunity.tweet_id },
    };

    const postResponse = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        Authorization: oauthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetPayload),
    });

    const postData = await postResponse.json();

    if (!postResponse.ok) {
      console.error('[twitter-reply] Post error:', postData);
      return new Response(JSON.stringify({
        success: false,
        error: postData.detail || postData.errors?.[0]?.message || 'Failed to post reply',
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const replyTweetId = postData.data?.id;

    // Update opportunity status
    await supabase
      .from('engagement_opportunities')
      .update({
        status: 'replied',
        reply_text: finalReplyText,
        reply_tweet_id: replyTweetId,
        replied_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);

    console.log(`[twitter-reply] Reply posted: ${replyTweetId}`);

    return new Response(JSON.stringify({
      success: true,
      replyText: finalReplyText,
      replyTweetId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[twitter-reply] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
