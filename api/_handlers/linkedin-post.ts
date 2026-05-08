// Migrated from supabase/functions/linkedin-post/index.ts
// Note: LinkedIn access token is read from client_social_credentials per client (saved by oauth callback).
// Defensive fallback: if LinkedIn integration not configured, returns 503.
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

const REQUIRED_ENV = ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'];

async function uploadImageToLinkedIn(
  imageUrl: string,
  accessToken: string,
  personUrn: string
): Promise<string | null> {
  try {
    // Step 1: Register upload
    const registerResponse = await fetch(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: personUrn,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      }
    );

    if (!registerResponse.ok) {
      console.error('LinkedIn register upload failed:', await registerResponse.text());
      return null;
    }

    const registerData = await registerResponse.json();
    const uploadUrl =
      registerData.value?.uploadMechanism?.[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ]?.uploadUrl;
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
      console.error('LinkedIn upload URL not found');
      return null;
    }

    // Step 2: Download and upload image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      console.error('LinkedIn image upload failed:', await uploadResponse.text());
      return null;
    }
    return asset;
  } catch (error) {
    console.error('Error uploading to LinkedIn:', error);
    return null;
  }
}

export default authedPost(async ({ body, res }) => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    res.status(503).json({
      error: 'LinkedIn integration not configured',
      missing_env: missing,
      hint: 'Add the missing env vars in Vercel and redeploy',
    });
    return;
  }

  const { scheduledPostId, planningItemId, source } = body || {};
  const pool = getPool();

  let post: any;
  let tableName: string;
  let postId: string;

  if (planningItemId || source === 'planning_items') {
    const itemId = planningItemId || scheduledPostId;
    post = await queryOne<any>(`SELECT * FROM planning_items WHERE id = $1`, [itemId]);
    if (!post) throw new Error('Item não encontrado');
    tableName = 'planning_items';
    postId = itemId;
  } else if (scheduledPostId) {
    post = await queryOne<any>(`SELECT * FROM scheduled_posts WHERE id = $1`, [scheduledPostId]);
    if (!post) throw new Error('Post não encontrado');
    tableName = 'scheduled_posts';
    postId = scheduledPostId;
  } else {
    throw new Error('scheduledPostId ou planningItemId é obrigatório');
  }

  console.log(`Processing LinkedIn post for ${tableName}: ${postId}`);

  await pool.query(`UPDATE ${tableName} SET status = 'publishing' WHERE id = $1`, [postId]);

  // Get credentials for this client
  const credentials = await queryOne<any>(
    `SELECT * FROM client_social_credentials WHERE client_id = $1 AND platform = 'linkedin' LIMIT 1`,
    [post.client_id]
  );

  if (!credentials) {
    throw new Error('Credenciais do LinkedIn não configuradas para este cliente');
  }
  if (!credentials.is_valid) {
    throw new Error(
      `Credenciais do LinkedIn inválidas: ${
        credentials.validation_error || 'Revalide as credenciais'
      }`
    );
  }

  const accessToken =
    credentials.oauth_access_token_encrypted || (credentials as any).oauth_access_token;
  if (!accessToken) {
    throw new Error('Access token do LinkedIn ausente');
  }
  const personUrn = `urn:li:person:${credentials.account_id}`;

  // Upload media if present
  const mediaAssets: string[] = [];
  const mediaUrls: string[] = post.media_urls || [];

  for (const imageUrl of mediaUrls.slice(0, 9)) {
    const asset = await uploadImageToLinkedIn(imageUrl, accessToken, personUrn);
    if (asset) mediaAssets.push(asset);
  }

  // Create post payload
  const postPayload: any = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: post.content },
        shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  if (mediaAssets.length > 0) {
    postPayload.specificContent['com.linkedin.ugc.ShareContent'].media = mediaAssets.map(
      (asset) => ({ status: 'READY', media: asset })
    );
  }

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(postPayload),
  });

  const responseText = await response.text();
  let responseData: any;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { raw: responseText };
  }

  if (!response.ok) {
    const errorMessage =
      responseData.message || responseData.raw || 'Erro ao publicar no LinkedIn';
    console.error('LinkedIn post error:', responseData);

    await pool.query(
      `UPDATE ${tableName} SET status = 'failed', error_message = $1, retry_count = COALESCE(retry_count, 0) + 1 WHERE id = $2`,
      [errorMessage, postId]
    );
    throw new Error(errorMessage);
  }

  const linkedInPostId =
    (response.headers.get('x-restli-id') as string | null) || responseData.id || null;

  // Success
  await pool.query(
    `UPDATE ${tableName} SET status = 'published', published_at = NOW(), external_post_id = $1, error_message = NULL WHERE id = $2`,
    [linkedInPostId, postId]
  );

  // Update kanban card if linked (only for scheduled_posts)
  if (tableName === 'scheduled_posts') {
    const kanbanCard = await queryOne<any>(
      `SELECT id, column_id FROM kanban_cards WHERE scheduled_post_id = $1 LIMIT 1`,
      [postId]
    );
    if (kanbanCard) {
      const currentColumn = await queryOne<any>(
        `SELECT workspace_id FROM kanban_columns WHERE id = $1`,
        [kanbanCard.column_id]
      );
      if (currentColumn) {
        const publishedColumn = await queryOne<any>(
          `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
          [currentColumn.workspace_id]
        );
        if (publishedColumn) {
          await pool.query(`UPDATE kanban_cards SET column_id = $1 WHERE id = $2`, [
            publishedColumn.id,
            kanbanCard.id,
          ]);
        }
      }
    }
  }

  console.log(`LinkedIn post published successfully: ${postId}`);

  return { success: true, postId, externalPostId: linkedInPostId };
});
