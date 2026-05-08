// Postiz publish handler — substitui late-post.
//
// Mantém a MESMA assinatura/payload/response do late-post pra ser drop-in:
//   { clientId, platform, content, mediaUrls?, mediaItems?, threadItems?, planningItemId?,
//     scheduledFor?, publishNow?, platformOptions? }
// →  { success, postId, status, url, platform, message }
//
// Diferenças vs Late:
//  - Persiste no metadata `postiz_post_id` / `postiz_integration_id` (em vez de `late_*`).
//  - Usa Postiz `POST /posts` com type='now' ou type='schedule'.
//  - Threads (twitter/threads) viram array `value[]` no Postiz.
//
// Tabela `client_social_credentials` continua sendo source-of-truth: armazenamos o
// `integration_id` Postiz no `metadata.postiz_integration_id` (também aceitamos
// `late_account_id` legado como fallback durante a migração).
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import {
  getPostizConfig,
  createPost,
  buildPlatformSettings,
  buildPostValue,
  POSTIZ_PLATFORM_MAP,
  type PostizCreatePostBody,
} from '../_lib/integrations/postiz.js';

const ALLOWED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads'] as const;
type AllowedPlatform = typeof ALLOWED_PLATFORMS[number];

export default authedPost(async ({ body }) => {
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
  if (!ALLOWED_PLATFORMS.includes(platform as AllowedPlatform)) {
    throw new Error(`Plataforma inválida: ${platform}`);
  }

  const igOpts = platformOptions?.instagram || {};
  const fbOpts = platformOptions?.facebook || {};
  let content: string = rawContent;
  if (platform === 'instagram' && igOpts.customCaption?.trim()) content = igOpts.customCaption;
  else if (platform === 'facebook' && fbOpts.customCaption?.trim()) content = fbOpts.customCaption;

  const hasContent = !!content?.trim();
  const hasThreadItems = threadItems && threadItems.length > 0 && threadItems.some((t: any) => t.text?.trim());
  if (!hasContent && !hasThreadItems) throw new Error('Conteúdo é obrigatório');

  // Threads max chars guard
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

  const cfg = getPostizConfig();

  // Lookup integration id armazenado pra esse cliente+plataforma.
  const credentials = await queryOne<any>(
    `SELECT * FROM client_social_credentials WHERE client_id = $1 AND platform = $2 LIMIT 1`,
    [clientId, platform],
  );
  if (!credentials) {
    throw new Error(`Conta ${platform} não conectada. Conecte a conta primeiro nas Integrações.`);
  }
  if (!credentials.is_valid) {
    throw new Error(`Credenciais do ${platform} expiradas. Reconecte a conta.`);
  }

  const meta = credentials.metadata as any;
  const integrationId =
    meta?.postiz_integration_id ||
    meta?.late_account_id || // fallback durante migração
    credentials.account_id;
  if (!integrationId) {
    throw new Error('Conta não configurada corretamente. Reconecte nas Integrações.');
  }

  // Normaliza mediaUrls a partir dos shapes possíveis (mediaItems[] ou mediaUrls[]).
  let resolvedMediaUrls: string[] = [];
  if (inputMediaItems && inputMediaItems.length > 0) {
    resolvedMediaUrls = inputMediaItems.map((m: any) => m.url).filter(Boolean);
  } else if (mediaUrls && mediaUrls.length > 0) {
    resolvedMediaUrls = mediaUrls.filter(Boolean);
  }

  // Build post item value(s)
  const value = await buildPostValue(cfg, {
    content,
    mediaUrls: resolvedMediaUrls.length > 0 ? resolvedMediaUrls : undefined,
    threadItems: threadItems && (platform === 'twitter' || platform === 'threads')
      ? threadItems
      : undefined,
  });

  // Build settings per-platform
  const settings = buildPlatformSettings(platform, {
    contentType: igOpts.contentType,
    firstComment: igOpts.firstComment || fbOpts.firstComment,
    title: platform === 'youtube' ? content.split('\n')[0]?.substring(0, 100) || 'Untitled' : undefined,
    privacyLevel: platform === 'tiktok' ? 'PUBLIC_TO_EVERYONE' : undefined,
    extra: {
      ...(platform === 'instagram' && igOpts.shareToFeed !== undefined ? { shareToFeed: igOpts.shareToFeed } : {}),
    },
  });

  const postType: PostizCreatePostBody['type'] = scheduledFor ? 'schedule' : (publishNow ? 'now' : 'draft');
  const postDate = scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString();

  const reqBody: PostizCreatePostBody = {
    type: postType,
    date: postDate,
    posts: [
      {
        integration: { id: integrationId },
        value,
        settings,
      },
    ],
  };

  console.log('[postiz-post] Posting to Postiz API:', { platform, integrationId, type: postType });

  let postizResp;
  try {
    postizResp = await createPost(cfg, reqBody);
  } catch (e: any) {
    throw new Error(`Erro ao publicar via Postiz: ${e?.message || 'unknown'}`);
  }

  const first = postizResp?.[0];
  const postizPostId = first?.postId || null;

  // Postiz não retorna a URL final imediatamente — vem via webhook ou polling /posts.
  // Por enquanto deixamos null; o webhook atualiza depois.
  const publishedUrl: string | null = null;
  const newStatus = scheduledFor ? 'scheduled' : (publishNow ? 'published' : 'draft');

  if (planningItemId) {
    const pool = getPool();
    const currentItem = await queryOne<any>(
      `SELECT metadata, workspace_id, added_to_library FROM planning_items WHERE id = $1`,
      [planningItemId],
    );
    const existingMetadata = (currentItem?.metadata as any) || {};
    const publishedPlatforms: string[] = existingMetadata.published_platforms || [];
    const postizPostIds: any = existingMetadata.postiz_post_ids || {};
    const publishedUrls: any = existingMetadata.published_urls || {};
    if (!publishedPlatforms.includes(platform)) publishedPlatforms.push(platform);
    if (postizPostId) postizPostIds[platform] = postizPostId;
    if (publishedUrl) publishedUrls[platform] = publishedUrl;

    const newMetadata = {
      ...existingMetadata,
      published_platforms: publishedPlatforms,
      postiz_post_ids: postizPostIds,
      published_urls: publishedUrls,
      published_url: publishedUrl,
      postiz_post_id: postizPostId,
      postiz_confirmed: !publishNow, // similar to late_confirmed semantics
      provider: 'postiz',
    };

    let columnIdToSet: string | null = null;
    if (publishNow && !scheduledFor && currentItem?.workspace_id) {
      const col = await queryOne<any>(
        `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
        [currentItem.workspace_id],
      );
      if (col) columnIdToSet = col.id;
    }

    const fields = ['status = $1', 'error_message = NULL', 'updated_at = NOW()', 'external_post_id = $2', 'metadata = $3::jsonb'];
    const values: any[] = [newStatus, postizPostId || null, JSON.stringify(newMetadata)];
    let placeholderIndex = 4;
    if (publishNow && !scheduledFor) fields.push(`published_at = NOW()`);
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

    if (publishNow && !scheduledFor && !currentItem?.added_to_library) {
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
      if (threadItems && threadItems.length > 0) {
        libraryContent = threadItems.map((t: any) => t.text).join('\n\n---\n\n');
      }
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
              postiz_post_id: postizPostId,
              provider: 'postiz',
              is_thread: threadItems && threadItems.length > 1,
              thread_count: threadItems?.length,
            }),
          ],
        );
        await pool.query(`UPDATE planning_items SET added_to_library = true WHERE id = $1`, [planningItemId]);
      } catch (e) {
        console.warn('[postiz-post] library insert failed:', e);
      }
    }
  }

  // Verifica se o user pediu identifier reconhecido pelo Postiz
  if (!POSTIZ_PLATFORM_MAP[platform]) {
    console.warn('[postiz-post] platform not in POSTIZ_PLATFORM_MAP, request was sent with raw __type=', platform);
  }

  const message = scheduledFor
    ? `Agendado para ${new Date(scheduledFor).toLocaleString('pt-BR')}`
    : (publishNow ? `Publicado em ${platform}!` : `Salvo como rascunho em ${platform}`);

  return {
    success: true,
    postId: postizPostId,
    status: newStatus,
    url: publishedUrl,
    platform,
    message,
    provider: 'postiz',
  };
});
