// Migrated from supabase/functions/twitter-post/index.ts
// Supports OAuth 2.0 (bearer token, no media upload) and OAuth 1.0a (with media upload).
// Defensive fallback: requires TWITTER_CONSUMER_KEY/SECRET to be configured.
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { createHmac } from 'node:crypto';

const REQUIRED_ENV = ['TWITTER_CONSUMER_KEY', 'TWITTER_CONSUMER_SECRET'];

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
      .join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
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
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };
  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    apiSecret,
    accessTokenSecret
  );
  const signedOAuthParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };
  return (
    'OAuth ' +
    Object.entries(signedOAuthParams)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(', ')
  );
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
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    const oauthHeader = generateOAuthHeader(
      'POST',
      uploadUrl,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret
    );

    const formData = new FormData();
    formData.append('media_data', base64Image);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: oauthHeader },
      body: formData,
    });

    if (!response.ok) {
      console.error('Media upload failed:', await response.text());
      return null;
    }
    const data = await response.json();
    return data.media_id_string;
  } catch (error) {
    console.error('Error uploading media:', error);
    return null;
  }
}

async function postTweetOAuth2(
  text: string,
  accessToken: string
): Promise<{ id: string }> {
  const tweetUrl = 'https://api.x.com/2/tweets';
  const response = await fetch(tweetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const responseData = await response.json();
  if (!response.ok) {
    console.error('Tweet OAuth2 error:', responseData);
    throw new Error(
      responseData.detail ||
        responseData.errors?.[0]?.message ||
        'Erro ao publicar tweet'
    );
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
): Promise<{ id: string }> {
  const tweetUrl = 'https://api.x.com/2/tweets';
  const oauthHeader = generateOAuthHeader(
    'POST',
    tweetUrl,
    apiKey,
    apiSecret,
    accessToken,
    accessTokenSecret
  );
  const tweetPayload: any = { text };
  if (mediaIds.length > 0) tweetPayload.media = { media_ids: mediaIds };
  if (replyToId) tweetPayload.reply = { in_reply_to_tweet_id: replyToId };

  const response = await fetch(tweetUrl, {
    method: 'POST',
    headers: {
      Authorization: oauthHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tweetPayload),
  });
  const responseData = await response.json();
  if (!response.ok) {
    console.error('Tweet error:', responseData);
    throw new Error(
      responseData.detail ||
        responseData.errors?.[0]?.message ||
        'Erro ao publicar tweet'
    );
  }
  return { id: responseData.data?.id };
}

export default authedPost(async ({ body, res, user }) => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    res.status(503).json({
      error: 'Twitter integration not configured',
      missing_env: missing,
      hint: 'Add the missing env vars in Vercel and redeploy',
    });
    return;
  }

  const { scheduledPostId, planningItemId } = body || {};
  const pool = getPool();

  let post: any = null;
  let tableName = '';
  let postId = '';

  if (planningItemId) {
    post = await queryOne<any>(`SELECT * FROM planning_items WHERE id = $1`, [planningItemId]);
    if (!post) throw new Error('Item não encontrado');
    tableName = 'planning_items';
    postId = planningItemId;
  } else if (scheduledPostId) {
    post = await queryOne<any>(`SELECT * FROM scheduled_posts WHERE id = $1`, [scheduledPostId]);
    if (!post) throw new Error('Post não encontrado');
    tableName = 'scheduled_posts';
    postId = scheduledPostId;
  } else {
    throw new Error('scheduledPostId ou planningItemId é obrigatório');
  }

  // Garante que o usuário pertence ao workspace dono do client deste post.
  if (post.client_id) {
    await assertClientAccess(user.id, post.client_id);
  }

  console.log(`Processing Twitter post for ${tableName}: ${postId}`);

  await pool.query(`UPDATE ${tableName} SET status = 'publishing' WHERE id = $1`, [postId]);

  const credentials = await queryOne<any>(
    // Usa a view `_decrypted` que aplica `decrypt_social_token` em cada
    // coluna `*_encrypted`.
    `SELECT * FROM client_social_credentials_decrypted WHERE client_id = $1 AND platform = 'twitter' LIMIT 1`,
    [post.client_id]
  );
  if (!credentials) throw new Error('Credenciais do Twitter não configuradas');
  if (!credentials.is_valid) {
    throw new Error(`Credenciais inválidas: ${credentials.validation_error}`);
  }

  // Try multiple credential storage shapes
  const creds: any = credentials;
  const meta = (creds.metadata || {}) as any;
  const api_key = creds.api_key || meta.api_key;
  const api_secret = creds.api_secret || meta.api_secret;
  const access_token = creds.access_token || meta.access_token;
  const access_token_secret = creds.access_token_secret || meta.access_token_secret;
  // View `_decrypted` expõe `oauth_access_token` em plaintext.
  const oauth_access_token =
    creds.oauth_access_token || creds.oauth_access_token_encrypted || meta.oauth_access_token;

  const useOAuth2 = !!oauth_access_token && !api_key;
  console.log(`Using ${useOAuth2 ? 'OAuth 2.0' : 'OAuth 1.0a'} authentication`);

  const metadata = post.metadata || {};
  const threadTweets: ThreadTweet[] = metadata.thread_tweets || [];
  const isThread = metadata.content_type === 'thread' && threadTweets.length > 0;

  let lastTweetId: string | null = null;
  const tweetIds: string[] = [];

  try {
    if (useOAuth2) {
      if (isThread) {
        for (let i = 0; i < threadTweets.length; i++) {
          const tweet = threadTweets[i];
          const result = await postTweetOAuth2(tweet.text, oauth_access_token);
          if (result) {
            lastTweetId = result.id;
            tweetIds.push(result.id);
            console.log(`Tweet ${i + 1} publicado (OAuth2): ${result.id}`);
          }
        }
      } else {
        const result = await postTweetOAuth2(post.content, oauth_access_token);
        if (result) tweetIds.push(result.id);
      }
    } else {
      if (!api_key || !api_secret || !access_token || !access_token_secret) {
        throw new Error(
          'OAuth 1.0a credentials missing (api_key, api_secret, access_token, access_token_secret)'
        );
      }
      if (isThread) {
        for (let i = 0; i < threadTweets.length; i++) {
          const tweet = threadTweets[i];
          const mediaIds: string[] = [];
          for (const imageUrl of (tweet.media_urls || []).slice(0, 4)) {
            const mediaId = await uploadMedia(
              imageUrl,
              api_key,
              api_secret,
              access_token,
              access_token_secret
            );
            if (mediaId) mediaIds.push(mediaId);
          }
          const result = await postTweet(
            tweet.text,
            mediaIds,
            lastTweetId,
            api_key,
            api_secret,
            access_token,
            access_token_secret
          );
          if (result) {
            lastTweetId = result.id;
            tweetIds.push(result.id);
            console.log(`Tweet ${i + 1} publicado: ${result.id}`);
          }
        }
      } else {
        const mediaUrls: string[] = post.media_urls || [];
        const mediaIds: string[] = [];
        for (const imageUrl of mediaUrls.slice(0, 4)) {
          const mediaId = await uploadMedia(
            imageUrl,
            api_key,
            api_secret,
            access_token,
            access_token_secret
          );
          if (mediaId) mediaIds.push(mediaId);
        }
        const result = await postTweet(
          post.content,
          mediaIds,
          null,
          api_key,
          api_secret,
          access_token,
          access_token_secret
        );
        if (result) {
          lastTweetId = result.id;
          tweetIds.push(result.id);
        }
      }
    }
  } catch (err: any) {
    await pool.query(
      `UPDATE ${tableName} SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err?.message || 'Erro desconhecido', postId]
    );
    throw err;
  }

  // Success
  await pool.query(
    `UPDATE ${tableName}
       SET status = 'published',
           published_at = NOW(),
           external_post_id = $1,
           error_message = NULL,
           metadata = $2::jsonb
     WHERE id = $3`,
    [tweetIds[0] || null, JSON.stringify({ ...metadata, tweet_ids: tweetIds }), postId]
  );

  console.log(`Twitter post(s) publicado(s): ${tweetIds.join(', ')}`);

  return { success: true, tweetIds, isThread };
});
