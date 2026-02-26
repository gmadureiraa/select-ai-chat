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
    Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&")
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const hmacSha1 = createHmac("sha1", signingKey);
  return hmacSha1.update(signatureBaseString).digest("base64");
}

function generateOAuthHeader(
  method: string,
  url: string,
  queryParams: Record<string, string>,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // Merge query params with oauth params for signature
  const allParams = { ...oauthParams, ...queryParams };
  const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessTokenSecret);

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return "OAuth " + Object.entries(signedOAuthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

interface FeedRequest {
  clientId: string;
  query?: string;
  maxResults?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { clientId, query: customQuery, maxResults = 20 } = await req.json() as FeedRequest;

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get client info for building search queries
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name, identity_guide, social_media, description')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Twitter credentials
    const { data: credentials, error: credError } = await supabase
      .from('client_social_credentials_decrypted')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'twitter')
      .single();

    if (credError || !credentials) {
      return new Response(JSON.stringify({ error: 'Twitter credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build search query from identity guide or use custom
    let searchQuery = customQuery || '';
    
    if (!searchQuery && client.identity_guide) {
      // Extract key topics from identity guide
      const guide = client.identity_guide;
      // Look for hashtags, keywords, people
      const hashtagMatches = guide.match(/#\w+/g) || [];
      const atMatches = guide.match(/@\w+/g) || [];
      
      // Build query from topics
      const topics: string[] = [];
      if (hashtagMatches.length > 0) topics.push(hashtagMatches.slice(0, 3).join(' OR '));
      if (atMatches.length > 0) topics.push(`(from:${atMatches.slice(0, 2).map((a: string) => a.replace('@', '')).join(' OR from:')})`);
      
      // Fallback: use client name/description keywords
      if (topics.length === 0) {
        const keywords = (client.description || client.name).split(/\s+/).filter((w: string) => w.length > 4).slice(0, 3);
        if (keywords.length > 0) topics.push(keywords.join(' OR '));
      }
      
      searchQuery = topics.join(' ') + ' -is:retweet lang:pt';
    }

    if (!searchQuery) {
      searchQuery = `${client.name} -is:retweet`;
    }

    console.log(`[twitter-feed] Searching: "${searchQuery}" for client ${clientId}`);

    // Search tweets via Twitter API v2
    const { api_key, api_secret, access_token, access_token_secret, oauth_access_token } = credentials;
    
    const baseUrl = 'https://api.x.com/2/tweets/search/recent';
    const queryParams: Record<string, string> = {
      query: searchQuery,
      max_results: Math.min(maxResults, 100).toString(),
      'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
      'user.fields': 'name,username,profile_image_url,public_metrics',
      expansions: 'author_id',
    };

    const queryString = Object.entries(queryParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    let response: Response;

    if (oauth_access_token && !api_key) {
      // OAuth 2.0
      response = await fetch(`${baseUrl}?${queryString}`, {
        headers: { Authorization: `Bearer ${oauth_access_token}` },
      });
    } else {
      // OAuth 1.0a - need to include query params in signature
      const encodedQueryParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(queryParams)) {
        encodedQueryParams[encodeURIComponent(k)] = encodeURIComponent(v);
      }
      
      const oauthHeader = generateOAuthHeader(
        'GET', baseUrl, encodedQueryParams,
        api_key, api_secret, access_token, access_token_secret
      );

      response = await fetch(`${baseUrl}?${queryString}`, {
        headers: { Authorization: oauthHeader },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[twitter-feed] API error ${response.status}:`, errorText);
      return new Response(JSON.stringify({ error: `Twitter API error: ${response.status}`, details: errorText }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const tweets = data.data || [];
    const users = data.includes?.users || [];

    // Map users by ID
    const userMap: Record<string, any> = {};
    for (const user of users) {
      userMap[user.id] = user;
    }

    // Format results
    const opportunities = tweets.map((tweet: any) => {
      const author = userMap[tweet.author_id] || {};
      return {
        tweet_id: tweet.id,
        author_username: author.username || 'unknown',
        author_name: author.name || 'Unknown',
        author_avatar: author.profile_image_url || null,
        author_followers: author.public_metrics?.followers_count || 0,
        tweet_text: tweet.text,
        tweet_metrics: tweet.public_metrics || {},
        tweet_created_at: tweet.created_at,
      };
    });

    // Score and categorize with AI (Gemini Flash)
    let scoredOpportunities = opportunities;
    
    if (opportunities.length > 0) {
      try {
        const scoringPrompt = `Classifique cada tweet abaixo em uma categoria e dê um score de relevância (0-100) para engajamento.

Contexto do cliente: ${client.name} - ${(client.description || '').substring(0, 200)}

Categorias:
- "networking": Tweet de uma conta grande/influente do nicho, boa para networking
- "community": Tweet de alguém da comunidade, bom para construir relações
- "growth": Tweet sobre um tópico viral/trending, bom para crescimento

Retorne APENAS um JSON array com objetos: [{"index": 0, "category": "...", "score": 50}, ...]

Tweets:
${opportunities.map((t: any, i: number) => `${i}. @${t.author_username} (${t.author_followers} followers): "${t.tweet_text.substring(0, 200)}"`).join('\n')}`;

        const geminiKey = Deno.env.get('GEMINI_API_KEY');
        if (geminiKey) {
          const aiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: scoringPrompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
              }),
            }
          );

          if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            const aiText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            // Parse JSON from response
            const jsonMatch = aiText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const scores = JSON.parse(jsonMatch[0]);
              for (const score of scores) {
                if (scoredOpportunities[score.index]) {
                  scoredOpportunities[score.index].category = score.category;
                  scoredOpportunities[score.index].relevance_score = score.score;
                }
              }
            }
          }
        }
      } catch (aiError) {
        console.warn('[twitter-feed] AI scoring failed, using defaults:', aiError);
      }
    }

    // Save to database (upsert)
    if (scoredOpportunities.length > 0) {
      const rows = scoredOpportunities.map((opp: any) => ({
        client_id: clientId,
        tweet_id: opp.tweet_id,
        author_username: opp.author_username,
        author_name: opp.author_name,
        author_avatar: opp.author_avatar,
        author_followers: opp.author_followers,
        tweet_text: opp.tweet_text,
        tweet_metrics: opp.tweet_metrics,
        tweet_created_at: opp.tweet_created_at,
        category: opp.category || 'community',
        relevance_score: opp.relevance_score || 50,
        status: 'new',
      }));

      const { error: upsertError } = await supabase
        .from('engagement_opportunities')
        .upsert(rows, { onConflict: 'client_id,tweet_id', ignoreDuplicates: true });

      if (upsertError) {
        console.warn('[twitter-feed] Upsert error:', upsertError);
      }
    }

    console.log(`[twitter-feed] Found ${scoredOpportunities.length} opportunities`);

    return new Response(JSON.stringify({
      success: true,
      count: scoredOpportunities.length,
      opportunities: scoredOpportunities,
      query: searchQuery,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[twitter-feed] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
