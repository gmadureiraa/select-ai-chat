import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostRequest {
  scheduledPostId: string;
}

// Generate OAuth 1.0a signature for Twitter
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
    // Download image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    // Upload to Twitter
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const oauthHeader = generateOAuthHeader("POST", uploadUrl, apiKey, apiSecret, accessToken, accessTokenSecret);

    const formData = new FormData();
    formData.append('media_data', base64Image);

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
      },
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { scheduledPostId } = await req.json() as PostRequest;

    console.log(`Processing Twitter post for scheduled_post: ${scheduledPostId}`);

    // Get the scheduled post
    const { data: post, error: postError } = await supabaseClient
      .from('scheduled_posts')
      .select('*')
      .eq('id', scheduledPostId)
      .single();

    if (postError || !post) {
      throw new Error(`Post não encontrado: ${postError?.message}`);
    }

    // Update status to publishing
    await supabaseClient
      .from('scheduled_posts')
      .update({ status: 'publishing' })
      .eq('id', scheduledPostId);

    // Get credentials for this client
    const { data: credentials, error: credError } = await supabaseClient
      .from('client_social_credentials')
      .select('*')
      .eq('client_id', post.client_id)
      .eq('platform', 'twitter')
      .single();

    if (credError || !credentials) {
      throw new Error('Credenciais do Twitter não configuradas para este cliente');
    }

    if (!credentials.is_valid) {
      throw new Error(`Credenciais do Twitter inválidas: ${credentials.validation_error || 'Revalide as credenciais'}`);
    }

    const { api_key, api_secret, access_token, access_token_secret } = credentials;

    // Upload media if present
    let mediaIds: string[] = [];
    const mediaUrls = post.media_urls || [];
    
    for (const imageUrl of mediaUrls.slice(0, 4)) { // Twitter allows max 4 images
      const mediaId = await uploadMedia(imageUrl, api_key, api_secret, access_token, access_token_secret);
      if (mediaId) {
        mediaIds.push(mediaId);
      }
    }

    // Post tweet
    const tweetUrl = "https://api.x.com/2/tweets";
    const oauthHeader = generateOAuthHeader("POST", tweetUrl, api_key, api_secret, access_token, access_token_secret);

    const tweetPayload: any = { text: post.content };
    if (mediaIds.length > 0) {
      tweetPayload.media = { media_ids: mediaIds };
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
      const errorMessage = responseData.detail || responseData.errors?.[0]?.message || 'Erro ao publicar tweet';
      console.error("Twitter post error:", responseData);
      
      // Update post with error
      await supabaseClient
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: errorMessage,
          retry_count: (post.retry_count || 0) + 1,
        })
        .eq('id', scheduledPostId);

      throw new Error(errorMessage);
    }

    // Success - update post
    await supabaseClient
      .from('scheduled_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: responseData.data?.id,
        error_message: null,
      })
      .eq('id', scheduledPostId);

    // Update kanban card if linked
    const { data: kanbanCard } = await supabaseClient
      .from('kanban_cards')
      .select('id, column_id')
      .eq('scheduled_post_id', scheduledPostId)
      .single();

    if (kanbanCard) {
      // Find "published" column in the same workspace
      const { data: columns } = await supabaseClient
        .from('kanban_columns')
        .select('id, workspace_id')
        .eq('column_type', 'published');

      if (columns && columns.length > 0) {
        // Get the workspace from the current column
        const { data: currentColumn } = await supabaseClient
          .from('kanban_columns')
          .select('workspace_id')
          .eq('id', kanbanCard.column_id)
          .single();

        if (currentColumn) {
          const publishedColumn = columns.find(c => c.workspace_id === currentColumn.workspace_id);
          if (publishedColumn) {
            await supabaseClient
              .from('kanban_cards')
              .update({ column_id: publishedColumn.id })
              .eq('id', kanbanCard.id);
          }
        }
      }
    }

    console.log(`Tweet published successfully: ${responseData.data?.id}`);

    return new Response(JSON.stringify({
      success: true,
      tweetId: responseData.data?.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error("Twitter post error:", error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false, 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
