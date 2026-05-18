// Publica/agenda post via Metricool. Drop-in compat com postiz-post.
//
// Body: { clientId, platform OR platforms[], content, mediaUrls?, threadItems?,
//          scheduledFor?, publishNow?, planningItemId?, platformOptions? }
//
// Resolve blogId via client_social_credentials.metadata.metricool_blog_id.
// Suporta: post normal, carousel (2-10 imgs), reel (vídeo), story.
import { authedPost } from '../_lib/handler.js';
import { assertClientAccess } from '../_lib/access.js';
import { getPool, queryOne } from '../_lib/db.js';
import {
  getMetricoolConfig,
  resolveBlogId,
  buildScheduledPostBody,
  createScheduledPost,
  normalizeMediaUrl,
  METRICOOL_PLATFORM_MAP,
} from '../_lib/integrations/metricool.js';

const ALLOWED_PLATFORMS = ['twitter', 'x', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'threads', 'pinterest', 'bluesky'] as const;

interface PublishMetricoolBody {
  clientId: string;
  platform?: string;
  platforms?: string[];
  content?: string;
  mediaUrls?: string[];
  mediaItems?: Array<{ url: string }>;
  threadItems?: Array<{ text: string; media_urls?: string[] }>;
  scheduledFor?: Date | string | null;
  publishNow?: boolean;
  planningItemId?: string;
  platformOptions?: Record<string, any>;
  timezone?: string;
  blogId?: string;
}

export interface PublishMetricoolResult {
  ok: boolean;
  success?: boolean;
  blogId?: string;
  scheduledPostId?: string | null;
  postId?: string | null;
  childIds?: string[];
  status?: string;
  platforms?: string[];
  providers?: any[];
  message?: string;
  provider?: string;
  error?: string;
}

/**
 * In-process callable variant — usado pelo cron `process-scheduled-posts`
 * pra publicar sem ir via HTTP. Reusa toda lógica do default handler.
 */
export async function publishMetricoolForClient(
  args: { body: PublishMetricoolBody; userId?: string },
  _ctx?: { userId?: string },
): Promise<PublishMetricoolResult> {
  const body = args.body;
  const userId = args.userId ?? _ctx?.userId;
  try {
    const result = await runMetricoolPost(body, userId);
    return {
      ok: true,
      success: true,
      blogId: result.blogId ?? undefined,
      scheduledPostId: result.postId,
      ...result,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, success: false, error: msg };
  }
}

export default authedPost(async ({ body, user }) => {
  return runMetricoolPost(body as PublishMetricoolBody, user.id);
});

async function runMetricoolPost(body: PublishMetricoolBody, userId?: string) {
  const {
    clientId,
    platform,
    platforms: rawPlatforms,
    content,
    mediaUrls,
    mediaItems,
    threadItems,
    scheduledFor,
    publishNow = true,
    planningItemId,
    platformOptions,
    timezone,
    blogId: directBlogId,
  } = body;

  if (!clientId) throw new Error('clientId é obrigatório');
  if (userId) await assertClientAccess(userId, clientId);

  // platforms[] tem prioridade; senão usa platform single
  const platforms: string[] = (rawPlatforms && rawPlatforms.length > 0)
    ? rawPlatforms
    : (platform ? [platform] : []);
  if (platforms.length === 0) throw new Error('platform ou platforms[] é obrigatório');

  for (const p of platforms) {
    if (!ALLOWED_PLATFORMS.includes(p as any)) throw new Error(`Plataforma inválida: ${p}`);
  }

  if (!content?.trim() && (!threadItems || threadItems.length === 0)) {
    throw new Error('content ou threadItems é obrigatório');
  }

  const cfg = getMetricoolConfig();

  // Resolve blogId: passado direto, ou via client_social_credentials
  let blogId = directBlogId;
  if (!blogId) blogId = await resolveBlogId(clientId);
  if (!blogId) {
    throw new Error(
      `Cliente sem blog Metricool mapeado. Conecte o cliente em Settings → Integrações Metricool primeiro.`,
    );
  }

  // Resolve mídias: cada URL externa precisa passar por normalize/image/url
  let resolvedMediaUrls: string[] = [];
  if (mediaItems && mediaItems.length > 0) {
    resolvedMediaUrls = mediaItems.map((m: any) => m.url).filter(Boolean);
  } else if (mediaUrls && mediaUrls.length > 0) {
    resolvedMediaUrls = mediaUrls.filter(Boolean);
  }
  const normalizedMedia: string[] = [];
  for (const url of resolvedMediaUrls) {
    try {
      const norm = await normalizeMediaUrl(cfg, blogId, url);
      normalizedMedia.push(norm);
    } catch (e: any) {
      console.warn('[metricool-post] normalize failed for', url, e.message);
      normalizedMedia.push(url); // fallback: tenta com URL original
    }
  }

  const igOpts = platformOptions?.instagram || {};
  const fbOpts = platformOptions?.facebook || {};
  const ttOpts = platformOptions?.tiktok || {};
  const ytOpts = platformOptions?.youtube || {};

  // Resolve content: prioriza customCaption se houver
  let resolvedContent = content;
  if (platforms.includes('instagram') && igOpts.customCaption?.trim()) resolvedContent = igOpts.customCaption;
  else if (platforms.includes('facebook') && fbOpts.customCaption?.trim()) resolvedContent = fbOpts.customCaption;

  // Threads (Twitter/Threads) — Metricool não tem `parentId` automático na criação;
  // pra threads de fato, criar 1 post por tweet (loop). Por simplicidade aqui criamos
  // o "primeiro" tweet apenas. TODO: iterar threadItems criando reply chain.
  const finalContent = threadItems && threadItems.length > 0 && (platforms.includes('twitter') || platforms.includes('x') || platforms.includes('threads'))
    ? threadItems[0].text
    : resolvedContent;

  // Datas
  const isSchedule = !!scheduledFor;
  const publicationDate = isSchedule
    ? new Date(scheduledFor).toISOString().slice(0, 19)
    : new Date().toISOString().slice(0, 19);
  const tz = timezone || 'America/Sao_Paulo';

  // Build body
  const postBody = buildScheduledPostBody({
    text: finalContent,
    publicationDate,
    timezone: tz,
    platforms,
    mediaUrls: normalizedMedia.length > 0 ? normalizedMedia : undefined,
    firstCommentText: igOpts.firstComment || fbOpts.firstComment,
    contentType: igOpts.contentType,
    draft: !publishNow && !isSchedule,
    videoThumbnailUrl: igOpts.instagramThumbnail,
    igTags: igOpts.tags,
    ytTitle: ytOpts.title,
    ytCategory: ytOpts.categoryId,
    ttPrivacy: ttOpts.privacyLevel,
    twitterReplySettings: platformOptions?.twitter?.replySettings,
    twitterPoll: platformOptions?.twitter?.poll,
  });

  console.log('[metricool-post] Posting:', {
    blogId,
    platforms,
    type: isSchedule ? 'schedule' : (publishNow ? 'now' : 'draft'),
    contentType: igOpts.contentType,
    mediaCount: normalizedMedia.length,
  });

  let resp;
  try {
    resp = await createScheduledPost(cfg, blogId, postBody);
  } catch (e: any) {
    throw new Error(`Erro ao publicar via Metricool: ${e?.message || 'unknown'}`);
  }

  const postId = resp?.id ? String(resp.id) : null;
  const newStatus = isSchedule ? 'scheduled' : (publishNow ? 'published' : 'draft');

  // Se thread Twitter/Threads/X com 2+ items, cria os filhos
  const isThread = threadItems && threadItems.length > 1
    && (platforms.includes('twitter') || platforms.includes('x') || platforms.includes('threads'));
  const childIds: string[] = [];
  if (isThread && postId) {
    for (let i = 1; i < threadItems.length; i++) {
      const item = threadItems[i];
      try {
        const childBody = buildScheduledPostBody({
          text: item.text,
          publicationDate,
          timezone: tz,
          platforms,
          mediaUrls: item.media_urls?.length ? item.media_urls : undefined,
          draft: !publishNow && !isSchedule,
        });
        (childBody as any).parentId = parseInt(postId);
        const childResp = await createScheduledPost(cfg, blogId, childBody);
        if (childResp?.id) childIds.push(String(childResp.id));
      } catch (e: any) {
        console.warn(`[metricool-post] child ${i} failed:`, e.message);
      }
    }
  }

  // Update planning_item se passado
  if (planningItemId) {
    const pool = getPool();
    const currentItem = await queryOne<any>(
      `SELECT metadata, workspace_id, added_to_library FROM planning_items WHERE id = $1`,
      [planningItemId],
    );
    const existingMeta = (currentItem?.metadata as any) || {};

    const newMeta = {
      ...existingMeta,
      metricool_post_id: postId,
      metricool_blog_id: blogId,
      metricool_thread_child_ids: childIds.length > 0 ? childIds : undefined,
      provider: 'metricool',
      providers_status: resp?.providers || [],
      published_via_metricool: !isSchedule && publishNow,
    };

    let columnIdToSet: string | null = null;
    if (publishNow && !isSchedule && currentItem?.workspace_id) {
      const col = await queryOne<any>(
        `SELECT id FROM kanban_columns WHERE workspace_id = $1 AND column_type = 'published' LIMIT 1`,
        [currentItem.workspace_id],
      );
      if (col) columnIdToSet = col.id;
    }

    const fields: string[] = [
      `status = $1`,
      `error_message = NULL`,
      `updated_at = NOW()`,
      `external_post_id = $2`,
      `metadata = $3::jsonb`,
    ];
    const values: any[] = [newStatus, postId, JSON.stringify(newMeta)];
    let idx = 4;
    if (publishNow && !isSchedule) fields.push(`published_at = NOW()`);
    if (isSchedule) {
      fields.push(`scheduled_at = $${idx++}`);
      values.push(scheduledFor);
    }
    if (columnIdToSet) {
      fields.push(`column_id = $${idx++}`);
      values.push(columnIdToSet);
    }
    values.push(planningItemId);
    await pool.query(`UPDATE planning_items SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  }

  return {
    success: true,
    postId,
    childIds,
    status: newStatus,
    platforms,
    providers: resp?.providers || [],
    message: isSchedule
      ? `Agendado para ${new Date(scheduledFor as string | Date).toLocaleString('pt-BR')}`
      : (publishNow ? `Publicado em ${platforms.join(', ')}` : 'Salvo como rascunho'),
    provider: 'metricool',
    blogId,
  };
}
