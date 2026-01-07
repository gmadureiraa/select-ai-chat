import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostRequest {
  scheduledPostId?: string;
  planningItemId?: string;
}

interface ThreadTweet {
  id: string;
  text: string;
  media_urls: string[];
}

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

  const signedOAuthParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return "OAuth " + Object.entries(signedOAuthParams)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");
}

async function uploadMedia(
  imageUrl: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const oauthHeader = generateOAuthHeader("POST", uploadUrl, apiKey, apiSecret, accessToken, accessTokenSecret);

    const formData = new FormData();
    formData.append('media_data', base64Image);

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: oauthHeader },
      body: formData,
    });

    if (!response.ok) {
      console.error("Media upload failed:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.media_id_string;
  } catch (error) {
    console.error("Error uploading media:", error);
    return null;
  }
}

async function postTweetOAuth2(
  text: string,
  accessToken: string
): Promise<{ id: string } | null> {
  const tweetUrl = "https://api.x.com/2/tweets";
  
  const response = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Tweet OAuth2 error:", responseData);
    throw new Error(responseData.detail || responseData.errors?.[0]?.message || 'Erro ao publicar tweet');
  }

  return { id: responseData.data?.id };
}

async function postTweet(
  text: string,
  mediaIds: string[],
  replyToId: string | null,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<{ id: string } | null> {
  const tweetUrl = "https://api.x.com/2/tweets";
  const oauthHeader = generateOAuthHeader("POST", tweetUrl, apiKey, apiSecret, accessToken, accessTokenSecret);

  const tweetPayload: any = { text };
  if (mediaIds.length > 0) {
    tweetPayload.media = { media_ids: mediaIds };
  }
  if (replyToId) {
    tweetPayload.reply = { in_reply_to_tweet_id: replyToId };
  }

  const response = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      Authorization: oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tweetPayload),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Tweet error:", responseData);
    throw new Error(responseData.detail || responseData.errors?.[0]?.message || 'Erro ao publicar tweet');
  }

  return { id: responseData.data?.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { scheduledPostId, planningItemId } = await req.json() as PostRequest;

    let post: any = null;
    let tableName = '';
    let postId = '';

    // Support both scheduled_posts and planning_items
    if (planningItemId) {
      const { data, error } = await supabaseClient
        .from('planning_items')
        .select('*')
        .eq('id', planningItemId)
        .single();
      if (error || !data) throw new Error(`Item não encontrado: ${error?.message}`);
      post = data;
      tableName = 'planning_items';
      postId = planningItemId;
    } else if (scheduledPostId) {
      const { data, error } = await supabaseClient
        .from('scheduled_posts')
        .select('*')
        .eq('id', scheduledPostId)
        .single();
      if (error || !data) throw new Error(`Post não encontrado: ${error?.message}`);
      post = data;
      tableName = 'scheduled_posts';
      postId = scheduledPostId;
    } else {
      throw new Error('scheduledPostId ou planningItemId é obrigatório');
    }

    console.log(`Processing Twitter post for ${tableName}: ${postId}`);

    await supabaseClient.from(tableName).update({ status: 'publishing' }).eq('id', postId);

    const { data: credentials, error: credError } = await supabaseClient
      .from('client_social_credentials')
      .select('*')
      .eq('client_id', post.client_id)
      .eq('platform', 'twitter')
      .single();

    if (credError || !credentials) throw new Error('Credenciais do Twitter não configuradas');
    if (!credentials.is_valid) throw new Error(`Credenciais inválidas: ${credentials.validation_error}`);

    const { api_key, api_secret, access_token, access_token_secret, oauth_access_token } = credentials;
    
    // Determine auth method: OAuth 2.0 (bearer) or OAuth 1.0a
    const useOAuth2 = !!oauth_access_token && !api_key;
    console.log(`Using ${useOAuth2 ? 'OAuth 2.0' : 'OAuth 1.0a'} authentication`);

    // Check if it's a thread
    const metadata = post.metadata || {};
    const threadTweets: ThreadTweet[] = metadata.thread_tweets || [];
    const isThread = metadata.content_type === 'thread' && threadTweets.length > 0;

    let lastTweetId: string | null = null;
    const tweetIds: string[] = [];

    if (useOAuth2) {
      // OAuth 2.0 - simpler, no media upload support
      if (isThread) {
        for (let i = 0; i < threadTweets.length; i++) {
          const tweet = threadTweets[i];
          // Note: OAuth 2.0 doesn't support media upload directly
          const result = await postTweetOAuth2(tweet.text, oauth_access_token);
          if (result) {
            lastTweetId = result.id;
            tweetIds.push(result.id);
            console.log(`Tweet ${i + 1} publicado (OAuth2): ${result.id}`);
          }
        }
      } else {
        const result = await postTweetOAuth2(post.content, oauth_access_token);
        if (result) {
          tweetIds.push(result.id);
        }
      }
    } else {
      // OAuth 1.0a - full support with media
      if (isThread) {
        // Post thread - each tweet in sequence
        for (let i = 0; i < threadTweets.length; i++) {
          const tweet = threadTweets[i];
          
          // Upload media for this tweet
          const mediaIds: string[] = [];
          for (const imageUrl of (tweet.media_urls || []).slice(0, 4)) {
            const mediaId = await uploadMedia(imageUrl, api_key, api_secret, access_token, access_token_secret);
            if (mediaId) mediaIds.push(mediaId);
          }

          const result = await postTweet(
            tweet.text,
            mediaIds,
            lastTweetId,
            api_key, api_secret, access_token, access_token_secret
          );

          if (result) {
            lastTweetId = result.id;
            tweetIds.push(result.id);
            console.log(`Tweet ${i + 1} publicado: ${result.id}`);
          }
        }
      } else {
        // Single tweet with optional media
        const mediaUrls = post.media_urls || [];
        const mediaIds: string[] = [];
        
        for (const imageUrl of mediaUrls.slice(0, 4)) {
          const mediaId = await uploadMedia(imageUrl, api_key, api_secret, access_token, access_token_secret);
          if (mediaId) mediaIds.push(mediaId);
        }

        const result = await postTweet(
          post.content,
          mediaIds,
          null,
          api_key, api_secret, access_token, access_token_secret
        );

        if (result) {
          lastTweetId = result.id;
          tweetIds.push(result.id);
        }
      }
    }

    // Success
    await supabaseClient.from(tableName).update({
      status: 'published',
      published_at: new Date().toISOString(),
      external_post_id: tweetIds[0] || null,
      error_message: null,
      metadata: { ...metadata, tweet_ids: tweetIds },
    }).eq('id', postId);

    console.log(`Twitter post(s) publicado(s): ${tweetIds.join(', ')}`);

    return new Response(JSON.stringify({
      success: true,
      tweetIds,
      isThread,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("Twitter post error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
