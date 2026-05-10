// Migrated from supabase/functions/late-post/index.ts (simplified)
// Note: this is a minimal port covering the main publish flow.
//
// @deprecated 2026-05-08: use `postiz-post` handler. Mantido como fallback durante migração
// Late.ai → Postiz. Será removido depois que todo front estiver no postiz-* e env Late
// estiver vazio em prod (LATE_API_KEY/LATE_WEBHOOK_SECRET unset).
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const LATE_API_BASE = 'https://getlate.dev/api';

const ALLOWED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads'] as const;
type AllowedPlatform = typeof ALLOWED_PLATFORMS[number];

export default authedPost(async ({ body, user }) => {
  const {
    clientId,
    platform,
    content: rawContent,
    mediaUrls,
    mediaItems: inputMediaItems,
    threadItems,
    planningItemId,
    scheduledFor,
    publishNow = true,
    platformOptions,
  } = body;

  if (!clientId || !platform) throw new Error('Cliente e plataforma são obrigatórios');
  if (!ALLOWED_PLATFORMS.includes(platform as AllowedPlatform)) throw new Error(`Plataforma inválida: ${platform}`);
  await assertClientAccess(user.id, clientId);

  const igOpts = platformOptions?.instagram || {};
  const fbOpts = platformOptions?.facebook || {};
  let content: string = rawContent;
  if (platform === 'instagram' && igOpts.customCaption?.trim()) content = igOpts.customCaption;
  else if (platform === 'facebook' && fbOpts.customCaption?.trim()) content = fbOpts.customCaption;

  const hasContent = !!content?.trim();
  const hasThreadItems = threadItems && threadItems.length > 0 && threadItems.some((t: any) => t.text?.trim());
  if (!hasContent && !hasThreadItems) throw new Error('Conteúdo é obrigatório');

  const THREADS_MAX_CHARS = 500;
  if (platform === 'threads' && content && content.length > THREADS_MAX_CHARS) {
    content = content.substring(0, THREADS_MAX_CHARS - 3) + '...';
  }
  if (platform === 'threads' && threadItems) {
    for (const item of threadItems) {
      if (item.text && item.text.length > THREADS_MAX_CHARS) {
        item.text = item.text.substring(0, THREADS_MAX_CHARS - 3) + '...';
      }
    }
  }

  const LATE_API_KEY = process.env.LATE_API_KEY;
  if (!LATE_API_KEY) throw new Error('LATE_API_KEY não configurada');

  const credentials = await queryOne<any>(
    `SELECT * FROM client_social_credentials WHERE client_id = $1 AND platform = $2 LIMIT 1`,
    [clientId, platform]
  );
  if (!credentials) throw new Error(`Conta ${platform} não conectada. Conecte a conta primeiro nas Integrações.`);
  if (!credentials.is_valid) throw new Error(`Credenciais do ${platform} expiradas. Reconecte a conta.`);

  const meta = credentials.metadata as any;
  const lateAccountId = meta?.late_account_id || credentials.account_id;
  if (!lateAccountId) throw new Error('Conta não configurada corretamente. Reconecte nas Integrações.');

  let finalMediaItems: Array<{ type: string; url: string; order?: number }> = [];
  if (inputMediaItems && inputMediaItems.length > 0) {
    finalMediaItems = inputMediaItems.map((m: any, i: number) => ({
      type: m.type || (m.url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
      url: m.url,
      order: i,
    }));
  } else if (mediaUrls && mediaUrls.length > 0) {
    finalMediaItems = mediaUrls.map((url: string, i: number) => ({
      type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
      url,
      order: i,
    }));
  }

  const postPayload: Record<string, unknown> = { publishNow };
  if (scheduledFor) {
    postPayload.publishNow = false;
    postPayload.scheduledFor = scheduledFor;
  }

  if (threadItems && threadItems.length > 0 && (platform === 'twitter' || platform === 'threads')) {
    const lateThreadItems = threadItems.map((item: any, i: number) => ({
      content: item.text,
      order: i,
      ...(item.media_urls?.length
        ? {
            mediaItems: item.media_urls.map((url: string, j: number) => ({
              type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
              url,
              order: j,
            })),
          }
        : {}),
    }));
    postPayload.platforms = [{ platform, accountId: lateAccountId, platformSpecificData: { threadItems: lateThreadItems } }];
    postPayload.content = lateThreadItems[0]?.content || content;
  } else {
    postPayload.content = content;
    const platformSpecificData: Record<string, unknown> = {};
    if (platform === 'tiktok') {
      platformSpecificData.privacy_level = 'PUBLIC_TO_EVERYONE';
      if (content.length > 150) platformSpecificData.title = content.substring(0, 147) + '...';
    }
    if (platform === 'youtube') {
      platformSpecificData.visibility = 'public';
      const lines = content.split('\n');
      platformSpecificData.title = lines[0]?.substring(0, 100) || 'Untitled';
      if (lines.length > 1) platformSpecificData.description = lines.slice(1).join('\n');
    }
    if (platform === 'instagram' && igOpts.contentType) {
      platformSpecificData.contentType = igOpts.contentType;
      if (igOpts.firstComment) platformSpecificData.firstComment = igOpts.firstComment;
      if (igOpts.shareToFeed !== undefined) platformSpecificData.shareToFeed = igOpts.shareToFeed;
    }
    if (platform === 'facebook' && fbOpts.contentType) {
      platformSpecificData.contentType = fbOpts.contentType;
      if (fbOpts.firstComment) platformSpecificData.firstComment = fbOpts.firstComment;
    }
    postPayload.platforms = [
      {
        platform,
        accountId: lateAccountId,
        ...(Object.keys(platformSpecificData).length > 0 ? { platformSpecificData } : {}),
      },
    ];
    if (finalMediaItems.length > 0) postPayload.mediaItems = finalMediaItems;
  }

  console.log('[late-post] Posting to Late API:', { platform, lateAccountId, publishNow });

  const lateRes = await fetch(`${LATE_API_BASE}/v1/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LATE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(postPayload),
  });
  const responseText = await lateRes.text();
  if (!lateRes.ok) {
    let userMessage = `Erro ao publicar (${lateRes.status})`;
    try {
      const j = JSON.parse(responseText);
      if (j.error) userMessage = j.error;
      else if (j.message) userMessage = j.message;
    } catch {}
    throw new Error(userMessage);
  }
  let postData: any;
  try { postData = JSON.parse(responseText); } catch { postData = { message: 'Publicado com sucesso' }; }

  const publishedUrl = postData.post?.platforms?.[0]?.platformPostUrl || postData.post?.platforms?.[0]?.publishedUrl || postData.post?.url || null;
  const postId = postData.post?._id || postData.postId;
  const newStatus = publishNow ? 'published' : 'scheduled';

  if (planningItemId) {
    const pool = getPool();
    const currentItem = await queryOne<any>(
      `SELECT metadata, workspace_id, added_to_library FROM planning_items WHERE id = $1`,
      [planningItemId]
    );
    const existingMetadata = (currentItem?.metadata as any) || {};
    const publishedPlatforms: string[] = existingMetadata.published_platforms || [];
    const latePostIds: any = existingMetadata.late_post_ids || {};
    const publishedUrls: any = existingMetadata.published_urls || {};
    if (!publishedPlatforms.includes(platform)) publishedPlatforms.push(platform);
    if (postId) latePostIds[platform] = postId;
    if (publishedUrl) publishedUrls[platform] = publishedUrl;

    const newMetadata = {
      ...existingMetadata,
      published_platforms: publishedPlatforms,
      late_post_ids: latePostIds,
      published_urls: publishedUrls,
      published_url: publishedUrl,
      late_post_id: postId,
      late_confirmed: !publishNow,
    };

    let columnIdToSet: string | null = null;
    if (publishNow && currentItem?.workspace_id) {
      const col = await queryOne<any>(
        `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
        [currentItem.workspace_id]
      );
      if (col) columnIdToSet = col.id;
    }

    const fields = ['status = $1', 'error_message = NULL', 'updated_at = NOW()', 'external_post_id = $2', 'metadata = $3::jsonb'];
    const values: any[] = [newStatus, postId || null, JSON.stringify(newMetadata)];
    let placeholderIndex = 4;
    if (publishNow) fields.push(`published_at = NOW()`);
    if (scheduledFor) {
      fields.push(`scheduled_at = $${placeholderIndex++}`);
      values.push(scheduledFor);
    }
    if (columnIdToSet) {
      fields.push(`column_id = $${placeholderIndex++}`);
      values.push(columnIdToSet);
    }
    values.push(planningItemId);
    await pool.query(`UPDATE planning_items SET ${fields.join(', ')} WHERE id = $${placeholderIndex}`, values);

    if (publishNow && !currentItem?.added_to_library) {
      const contentTypeMap: Record<string, string> = {
        twitter: 'tweet',
        linkedin: 'linkedin_post',
        instagram: 'instagram_post',
        facebook: 'facebook_post',
        tiktok: 'tiktok_video',
        youtube: 'youtube_video',
        threads: 'threads_post',
      };
      let libraryContent: string = content;
      if (threadItems && threadItems.length > 0) libraryContent = threadItems.map((t: any) => t.text).join('\n\n---\n\n');
      try {
        await pool.query(
          `INSERT INTO client_content_library (client_id, title, content, content_type, content_url, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            clientId,
            libraryContent.substring(0, 100),
            libraryContent,
            contentTypeMap[platform] || 'post',
            publishedUrl,
            JSON.stringify({
              platform,
              all_platforms: publishedPlatforms,
              posted_at: new Date().toISOString(),
              late_post_id: postId,
              is_thread: threadItems && threadItems.length > 1,
              thread_count: threadItems?.length,
            }),
          ]
        );
        await pool.query(`UPDATE planning_items SET added_to_library = true WHERE id = $1`, [planningItemId]);
      } catch (e) {
        console.warn('[late-post] library insert failed:', e);
      }
    }
  }

  return {
    success: true,
    postId,
    status: newStatus,
    url: publishedUrl,
    platform,
    message: publishNow ? `Publicado em ${platform}!` : `Agendado para ${new Date(scheduledFor!).toLocaleString('pt-BR')}`,
  };
});
