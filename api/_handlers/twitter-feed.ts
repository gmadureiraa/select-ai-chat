// Migrated from supabase/functions/twitter-feed/index.ts
import { createHmac } from 'node:crypto';
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

function generateOAuthSignature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function generateOAuthHeader(method: string, url: string, queryParams: Record<string, string>, apiKey: string, apiSecret: string, accessToken: string, accessTokenSecret: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };
  const allParams = { ...oauthParams, ...queryParams };
  const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessTokenSecret);
  const signed = { ...oauthParams, oauth_signature: signature };
  return 'OAuth ' + Object.entries(signed).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(', ');
}

export default authedPost(async ({ body }) => {
  const { clientId, query: customQuery, maxResults = 20 } = body;
  if (!clientId) throw new Error('clientId is required');

  const client = await queryOne<any>(
    `SELECT name, identity_guide, social_media, description FROM clients WHERE id = $1`,
    [clientId]
  );
  if (!client) throw new Error('Client not found');

  const credentials = await queryOne<any>(
    `SELECT * FROM client_social_credentials_decrypted WHERE client_id = $1 AND platform = 'twitter' LIMIT 1`,
    [clientId]
  );
  if (!credentials) throw new Error('Twitter credentials not configured');

  let searchQuery = customQuery || '';
  if (!searchQuery && client.identity_guide) {
    const guide = client.identity_guide;
    const hashtagMatches = guide.match(/#\w+/g) || [];
    const atMatches = guide.match(/@\w+/g) || [];
    const topics: string[] = [];
    if (hashtagMatches.length > 0) topics.push(hashtagMatches.slice(0, 3).join(' OR '));
    if (atMatches.length > 0) topics.push(`(from:${atMatches.slice(0, 2).map((a: string) => a.replace('@', '')).join(' OR from:')})`);
    if (topics.length === 0) {
      const keywords = (client.description || client.name).split(/\s+/).filter((w: string) => w.length > 4).slice(0, 3);
      if (keywords.length > 0) topics.push(keywords.join(' OR '));
    }
    searchQuery = topics.join(' ') + ' -is:retweet lang:pt';
  }
  if (!searchQuery) searchQuery = `${client.name} -is:retweet`;

  console.log(`[twitter-feed] "${searchQuery}" client=${clientId}`);

  const { api_key, api_secret, access_token, access_token_secret, oauth_access_token } = credentials;
  const baseUrl = 'https://api.x.com/2/tweets/search/recent';
  const queryParams: Record<string, string> = {
    query: searchQuery,
    max_results: Math.min(maxResults, 100).toString(),
    'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
    'user.fields': 'name,username,profile_image_url,public_metrics',
    expansions: 'author_id',
  };
  const queryString = Object.entries(queryParams).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  let response: Response;
  if (oauth_access_token && !api_key) {
    response = await fetch(`${baseUrl}?${queryString}`, { headers: { Authorization: `Bearer ${oauth_access_token}` } });
  } else {
    const encQ: Record<string, string> = {};
    for (const [k, v] of Object.entries(queryParams)) encQ[encodeURIComponent(k)] = encodeURIComponent(v);
    const oauthHeader = generateOAuthHeader('GET', baseUrl, encQ, api_key, api_secret, access_token, access_token_secret);
    response = await fetch(`${baseUrl}?${queryString}`, { headers: { Authorization: oauthHeader } });
  }
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Twitter API error: ${response.status}: ${t.slice(0, 300)}`);
  }
  const data = await response.json();
  const tweets = data.data || [];
  const users = data.includes?.users || [];
  const userMap: Record<string, any> = {};
  for (const u of users) userMap[u.id] = u;
  const opportunities = tweets.map((t: any) => {
    const author = userMap[t.author_id] || {};
    return {
      tweet_id: t.id,
      author_username: author.username || 'unknown',
      author_name: author.name || 'Unknown',
      author_avatar: author.profile_image_url || null,
      author_followers: author.public_metrics?.followers_count || 0,
      tweet_text: t.text,
      tweet_metrics: t.public_metrics || {},
      tweet_created_at: t.created_at,
    };
  });

  let scored = opportunities;
  if (opportunities.length > 0) {
    try {
      const prompt = `Classifique cada tweet abaixo em uma categoria e dê um score de relevância (0-100) para engajamento.

Contexto do cliente: ${client.name} - ${(client.description || '').substring(0, 200)}

Categorias:
- "networking": conta grande/influente do nicho
- "community": alguém da comunidade
- "growth": tópico viral/trending

Retorne APENAS um JSON array: [{"index": 0, "category": "...", "score": 50}, ...]

Tweets:
${opportunities.map((t: any, i: number) => `${i}. @${t.author_username} (${t.author_followers} followers): "${t.tweet_text.substring(0, 200)}"`).join('\n')}`;

      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY;
      if (geminiKey) {
        const ai = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 2000 } }) }
        );
        if (ai.ok) {
          const aiResult = await ai.json();
          const aiText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const jm = aiText.match(/\[[\s\S]*\]/);
          if (jm) {
            const scores = JSON.parse(jm[0]);
            for (const s of scores) {
              if (scored[s.index]) {
                scored[s.index].category = s.category;
                scored[s.index].relevance_score = s.score;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[twitter-feed] AI scoring failed:', e);
    }
  }

  if (scored.length > 0) {
    try {
      const pool = getPool();
      for (const opp of scored) {
        await pool.query(
          `INSERT INTO engagement_opportunities (
             client_id, tweet_id, author_username, author_name, author_avatar,
             author_followers, tweet_text, tweet_metrics, tweet_created_at,
             category, relevance_score, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
           ON CONFLICT (client_id, tweet_id) DO NOTHING`,
          [
            clientId, opp.tweet_id, opp.author_username, opp.author_name, opp.author_avatar,
            opp.author_followers, opp.tweet_text, JSON.stringify(opp.tweet_metrics), opp.tweet_created_at,
            opp.category || 'community', opp.relevance_score || 50, 'new',
          ]
        );
      }
    } catch (e) {
      console.warn('[twitter-feed] upsert failed:', e);
    }
  }
  console.log(`[twitter-feed] ${scored.length} opportunities`);
  return { success: true, count: scored.length, opportunities: scored, query: searchQuery };
});
