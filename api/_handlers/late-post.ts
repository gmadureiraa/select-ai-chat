// Migrated from supabase/functions/late-post/index.ts (simplified)
// Note: this is a minimal port covering the main publish flow.
//
// 2026-05-18: Late/Zernio voltou a ser o publisher canônico do KAI 2.0.
// O handler é chamado pelo front autenticado; o cron usa publishViaLate().
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { buildPublishMediaItems, resolveMediaUrl } from '../_lib/media.js';

const LATE_API_BASE = 'https://getlate.dev/api';

const ALLOWED_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads', 'pinterest', 'bluesky'] as const;
type AllowedPlatform = typeof ALLOWED_PLATFORMS[number];
type PlanningItemContext = {
  metadata: unknown;
  workspace_id: string;
  added_to_library: boolean | null;
};
type JsonRecord = Record<string, unknown>;
type MediaInput = { type?: string; url: string };
type ThreadItemInput = { text?: string; media_urls?: string[] };
type PlatformOptions = Partial<Record<'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube', JsonRecord>>;
type LateCredential = {
  is_valid: boolean;
  metadata: unknown;
  account_id: string | null;
};
type LatePostResponse = {
  post?: {
    _id?: string;
    url?: string | null;
    platforms?: Array<{
      platformPostUrl?: string | null;
      publishedUrl?: string | null;
    }>;
  };
  postId?: string | null;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringOpt(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function boolOpt(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseLateResponse(responseText: string): LatePostResponse {
  try {
    return asRecord(JSON.parse(responseText)) as LatePostResponse;
  } catch {
    return {};
  }
}

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
  } = body as {
    clientId?: string;
    platform?: string;
    content?: string;
    mediaUrls?: string[];
    mediaItems?: MediaInput[];
    threadItems?: ThreadItemInput[];
    planningItemId?: string;
    scheduledFor?: string;
    publishNow?: boolean;
    platformOptions?: PlatformOptions;
  };

  if (!clientId || !platform) throw new Error('Cliente e plataforma são obrigatórios');
  if (!ALLOWED_PLATFORMS.includes(platform as AllowedPlatform)) throw new Error(`Plataforma inválida: ${platform}`);
  const { workspaceId } = await assertClientAccess(user.id, clientId);
  let planningItemContext: PlanningItemContext | null = null;
  if (planningItemId) {
    planningItemContext = await queryOne<PlanningItemContext>(
      `SELECT metadata, workspace_id, added_to_library
         FROM planning_items
        WHERE id = $1
          AND client_id = $2
          AND workspace_id = $3
        LIMIT 1`,
      [planningItemId, clientId, workspaceId]
    );
    if (!planningItemContext) {
      throw new Error('planningItemId não pertence ao cliente/workspace informado');
    }
  }

  const igOpts = asRecord(platformOptions?.instagram);
  const fbOpts = asRecord(platformOptions?.facebook);
  const liOpts = asRecord(platformOptions?.linkedin);
  const ttOpts = asRecord(platformOptions?.tiktok);
  const ytOpts = asRecord(platformOptions?.youtube);
  let content = rawContent ?? '';
  const instagramCaption = stringOpt(igOpts, 'customCaption');
  const facebookCaption = stringOpt(fbOpts, 'customCaption');
  if (platform === 'instagram' && instagramCaption) content = instagramCaption;
  else if (platform === 'facebook' && facebookCaption) content = facebookCaption;

  const hasContent = !!content?.trim();
  const hasThreadItems = threadItems && threadItems.length > 0 && threadItems.some((t) => t.text?.trim());
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

  const credentials = await queryOne<LateCredential>(
    `SELECT * FROM client_social_credentials WHERE client_id = $1 AND platform = $2 LIMIT 1`,
    [clientId, platform]
  );
  if (!credentials) throw new Error(`Conta ${platform} não conectada. Conecte a conta primeiro nas Integrações.`);
  if (!credentials.is_valid) throw new Error(`Credenciais do ${platform} expiradas. Reconecte a conta.`);

  const meta = asRecord(credentials.metadata);
  const lateAccountId = stringOpt(meta, 'late_account_id') || credentials.account_id;
  if (!lateAccountId) throw new Error('Conta não configurada corretamente. Reconecte nas Integrações.');

  const finalMediaItems = buildPublishMediaItems({
    mediaUrls,
    mediaItems: inputMediaItems,
    metadata: planningItemContext?.metadata,
  });

  const postPayload: Record<string, unknown> = { publishNow };
  if (scheduledFor) {
    postPayload.publishNow = false;
    postPayload.scheduledFor = scheduledFor;
  }

  if (threadItems && threadItems.length > 0 && (platform === 'twitter' || platform === 'threads')) {
    const lateThreadItems = threadItems.map((item, i) => ({
      content: item.text,
      order: i,
      ...(item.media_urls?.length
        ? {
            mediaItems: item.media_urls.map((url: string, j: number) => ({
              type: buildPublishMediaItems({
                mediaUrls: [url],
                metadata: planningItemContext?.metadata,
              })[0]?.type || 'image',
              url: resolveMediaUrl(url, planningItemContext?.metadata),
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
      platformSpecificData.privacy_level = stringOpt(ttOpts, 'privacyLevel') || 'PUBLIC_TO_EVERYONE';
      const ttTitle = stringOpt(ttOpts, 'title');
      if (ttTitle) platformSpecificData.title = ttTitle.substring(0, 150);
      else if (content.length > 150) platformSpecificData.title = content.substring(0, 147) + '...';
      const disableDuet = boolOpt(ttOpts, 'disableDuet');
      const disableStitch = boolOpt(ttOpts, 'disableStitch');
      const disableComment = boolOpt(ttOpts, 'disableComment');
      if (disableDuet !== undefined) platformSpecificData.disable_duet = disableDuet;
      if (disableStitch !== undefined) platformSpecificData.disable_stitch = disableStitch;
      if (disableComment !== undefined) platformSpecificData.disable_comment = disableComment;
    }

    if (platform === 'youtube') {
      platformSpecificData.visibility = stringOpt(ytOpts, 'visibility') || 'public';
      const lines = content.split('\n');
      platformSpecificData.title = stringOpt(ytOpts, 'title') || lines[0]?.substring(0, 100) || 'Untitled';
      const ytDescription = stringOpt(ytOpts, 'description');
      if (ytDescription) platformSpecificData.description = ytDescription;
      else if (lines.length > 1) platformSpecificData.description = lines.slice(1).join('\n');
      const madeForKids = boolOpt(ytOpts, 'madeForKids');
      const categoryId = stringOpt(ytOpts, 'categoryId');
      if (madeForKids !== undefined) platformSpecificData.madeForKids = madeForKids;
      if (categoryId) platformSpecificData.categoryId = categoryId;
    }

    if (platform === 'instagram') {
      let igContentType = stringOpt(igOpts, 'contentType');
      if (!igContentType && finalMediaItems.length > 0) {
        if (finalMediaItems.length >= 2) igContentType = 'carousel';
        else if (finalMediaItems[0].type === 'video') igContentType = 'reels';
        else igContentType = 'post';
      }
      if (igContentType) {
        platformSpecificData.contentType = igContentType;
        if (igContentType === 'reels') {
          const shareToFeed = boolOpt(igOpts, 'shareToFeed');
          const trialReel = boolOpt(igOpts, 'trialReel');
          const audioName = stringOpt(igOpts, 'audioName');
          if (shareToFeed !== undefined) platformSpecificData.shareToFeed = shareToFeed;
          if (trialReel !== undefined) platformSpecificData.trialReel = trialReel;
          if (audioName) platformSpecificData.audioName = audioName;
        }
        const firstComment = stringOpt(igOpts, 'firstComment');
        if (firstComment) platformSpecificData.firstComment = firstComment;
      }
    }

    if (platform === 'facebook') {
      let fbContentType = stringOpt(fbOpts, 'contentType');
      if (!fbContentType && finalMediaItems.length > 0) {
        if (finalMediaItems.length === 1 && finalMediaItems[0].type === 'video') {
          fbContentType = 'reels';
        } else {
          fbContentType = 'post';
        }
      }
      if (fbContentType) platformSpecificData.contentType = fbContentType;
      const firstComment = stringOpt(fbOpts, 'firstComment');
      if (firstComment) platformSpecificData.firstComment = firstComment;
    }

    if (platform === 'linkedin') {
      const onlyMediaIsPdf =
        finalMediaItems.length === 1 && /\.pdf(\?|$)/i.test(finalMediaItems[0].url);
      const isCarouselPdf = stringOpt(liOpts, 'format') === 'pdf-document' || onlyMediaIsPdf;
      if (isCarouselPdf) {
        platformSpecificData.format = 'pdf-document';
        const liTitle = stringOpt(liOpts, 'title');
        if (liTitle) platformSpecificData.title = liTitle.substring(0, 100);
      }
      const visibility = stringOpt(liOpts, 'visibility');
      if (visibility) platformSpecificData.visibility = visibility;
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
    } catch {
      // Late sometimes returns plain text/HTML for upstream failures.
    }
    throw new Error(userMessage);
  }
  const postData = parseLateResponse(responseText);

  const publishedUrl = postData.post?.platforms?.[0]?.platformPostUrl || postData.post?.platforms?.[0]?.publishedUrl || postData.post?.url || null;
  const postId = postData.post?._id || postData.postId;
  const newStatus = publishNow ? 'published' : 'scheduled';

  if (planningItemId) {
    const pool = getPool();
    const currentItem = planningItemContext;
    const existingMetadata = asRecord(currentItem?.metadata);
    const publishedPlatforms = stringArray(existingMetadata.published_platforms);
    const latePostIds = asRecord(existingMetadata.late_post_ids);
    const publishedUrls = asRecord(existingMetadata.published_urls);
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
      const col = await queryOne<{ id: string }>(
        `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
        [currentItem.workspace_id]
      );
      if (col) columnIdToSet = col.id;
    }

    const fields = ['status = $1', 'error_message = NULL', 'updated_at = NOW()', 'external_post_id = $2', 'metadata = $3::jsonb'];
    const values: unknown[] = [newStatus, postId || null, JSON.stringify(newMetadata)];
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
    values.push(clientId, workspaceId);
    await pool.query(
      `UPDATE planning_items SET ${fields.join(', ')}
        WHERE id = $${placeholderIndex}
          AND client_id = $${placeholderIndex + 1}
          AND workspace_id = $${placeholderIndex + 2}`,
      values
    );

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
      if (threadItems && threadItems.length > 0) {
        libraryContent = threadItems.map((t) => t.text ?? '').join('\n\n---\n\n');
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
              late_post_id: postId,
              is_thread: threadItems && threadItems.length > 1,
              thread_count: threadItems?.length,
            }),
          ]
        );
        await pool.query(
          `UPDATE planning_items
              SET added_to_library = true
            WHERE id = $1
              AND client_id = $2
              AND workspace_id = $3`,
          [planningItemId, clientId, workspaceId]
        );
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
