// Migrated from supabase/functions/twitter-reply/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { createHmac } from 'node:crypto';

function generateOAuthSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
  const base = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('&')
  )}`;
  const key = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', key).update(base).digest('base64');
}

function generateOAuthHeader(method: string, url: string, apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };
  const sig = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
  const signed = { ...oauthParams, oauth_signature: sig };
  return 'OAuth ' + Object.entries(signed).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(', ');
}

export default authedPost(async ({ body, user }) => {
  const { clientId, opportunityId, replyText, tone = 'insightful', generateOnly = false } = body;
  if (!clientId || !opportunityId) throw new Error('clientId and opportunityId are required');
  await assertClientAccess(user.id, clientId);

  const pool = getPool();
  const opportunity = await queryOne<any>(
    'SELECT * FROM engagement_opportunities WHERE id = $1',
    [opportunityId]
  );
  if (!opportunity) {
    return { success: false, error: 'Opportunity not found' };
  }
  const client = await queryOne<any>(
    'SELECT name, identity_guide, description FROM clients WHERE id = $1',
    [clientId]
  );

  let finalReplyText: string = replyText || '';
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
${client?.identity_guide ? `GUIA DE IDENTIDADE (resumo): ${String(client.identity_guide).substring(0, 500)}` : ''}

TOM ESCOLHIDO: ${tone.toUpperCase()}
${toneInstructions[tone] || ''}

REGRAS:
1. Máximo 280 caracteres
2. Seja natural, NÃO pareça bot
3. Agregue valor real à conversa
4. NÃO use hashtags gratuitas
5. NÃO comece com "Ótimo ponto!" ou frases genéricas
6. Mantenha a voz/personalidade do cliente

Retorne APENAS o texto da reply, sem aspas.`;

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!geminiKey) return { success: false, error: 'AI key not configured' };

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 200 } }),
    });
    if (!r.ok) {
      const t = await r.text();
      return { success: false, error: 'AI generation failed', details: t };
    }
    const ai = await r.json();
    finalReplyText = (ai?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (finalReplyText.length > 280) finalReplyText = finalReplyText.substring(0, 277) + '...';
  }

  if (generateOnly) {
    return { success: true, replyText: finalReplyText, generateOnly: true };
  }

  // Get credentials
  const credentials = await queryOne<any>(
    "SELECT * FROM client_social_credentials_decrypted WHERE client_id = $1 AND platform = 'twitter'",
    [clientId]
  );
  if (!credentials) return { success: false, error: 'Twitter credentials not configured' };
  const { api_key, api_secret, access_token, access_token_secret } = credentials;

  const tweetUrl = 'https://api.x.com/2/tweets';
  const oauthHeader = generateOAuthHeader('POST', tweetUrl, api_key, api_secret, access_token, access_token_secret);
  const tweetPayload = { text: finalReplyText, reply: { in_reply_to_tweet_id: opportunity.tweet_id } };
  const postResponse = await fetch(tweetUrl, {
    method: 'POST',
    headers: { Authorization: oauthHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(tweetPayload),
  });
  const postData = await postResponse.json();
  if (!postResponse.ok) {
    console.error('[twitter-reply] Post error:', postData);
    return { success: false, error: postData.detail || postData.errors?.[0]?.message || 'Failed to post reply' };
  }
  const replyTweetId = postData.data?.id;
  await pool.query(
    `UPDATE engagement_opportunities SET status = 'replied', reply_text = $1, reply_tweet_id = $2, replied_at = NOW() WHERE id = $3`,
    [finalReplyText, replyTweetId, opportunityId]
  );
  console.log(`[twitter-reply] Reply posted: ${replyTweetId}`);
  return { success: true, replyText: finalReplyText, replyTweetId };
});
