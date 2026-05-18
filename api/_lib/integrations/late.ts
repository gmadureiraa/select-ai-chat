// Late/Zernio publish helper — extracted from late-post.ts pra ser reusável
// pelo cron `process-scheduled-posts` (que não tem auth user, só CRON_SECRET).
//
// Extrai a logica de publish da Late API + update de planning_items pra função
// pura. late-post.ts (authedPost) também pode reusar isso depois.
//
// Criado 2026-05-18 rev2 quando Metricool foi substituído por Late/Zernio
// como único publisher. Antes, process-scheduled-posts importava
// `publishMetricoolForClient` de metricool-post.ts (arquivado).

import { getPool, queryOne } from '../db.js';

const LATE_API_BASE = 'https://getlate.dev/api';

export const ALLOWED_LATE_PLATFORMS = [
  'twitter',
  'linkedin',
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'threads',
] as const;
export type LatePlatform = (typeof ALLOWED_LATE_PLATFORMS)[number];

export interface PublishViaLateInput {
  clientId: string;
  platform: string;
  content: string;
  mediaUrls?: string[];
  mediaItems?: Array<{ type?: string; url: string }>;
  threadItems?: Array<{ text: string; media_urls?: string[] }>;
  planningItemId?: string;
  scheduledFor?: string | null; // ISO; null/undefined = publishNow
  platformOptions?: Record<string, any>;
}

export interface PublishViaLateResult {
  success: boolean;
  postId: string | null;
  status: 'published' | 'scheduled';
  url: string | null;
  platform: string;
  message: string;
}

/**
 * Publica via Late.ai (Zernio) e atualiza o planning_item.
 * Pura — não depende de Request/auth user; o caller é responsável por validar
 * acesso. Usa LATE_API_KEY do env.
 */
export async function publishViaLate(
  input: PublishViaLateInput,
): Promise<PublishViaLateResult> {
  const {
    clientId,
    platform,
    content: rawContent,
    mediaUrls,
    mediaItems: inputMediaItems,
    threadItems,
    planningItemId,
    scheduledFor,
    platformOptions,
  } = input;

  if (!clientId || !platform) throw new Error('Cliente e plataforma são obrigatórios');
  if (!ALLOWED_LATE_PLATFORMS.includes(platform as LatePlatform)) {
    throw new Error(`Plataforma inválida: ${platform}`);
  }

  const igOpts = platformOptions?.instagram || {};
  const fbOpts = platformOptions?.facebook || {};
  let content = rawContent;
  if (platform === 'instagram' && igOpts.customCaption?.trim()) content = igOpts.customCaption;
  else if (platform === 'facebook' && fbOpts.customCaption?.trim()) content = fbOpts.customCaption;

  const hasContent = !!content?.trim();
  const hasThreadItems =
    threadItems && threadItems.length > 0 && threadItems.some((t) => t.text?.trim());
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
    [clientId, platform],
  );
  if (!credentials) {
    throw new Error(
      `Conta ${platform} não conectada. Conecte primeiro nas Integrações (Late/Zernio).`,
    );
  }
  if (!credentials.is_valid) {
    throw new Error(`Credenciais do ${platform} expiradas. Reconecte a conta.`);
  }

  const meta = (credentials.metadata as any) || {};
  const lateAccountId = meta?.late_account_id || credentials.account_id;
  if (!lateAccountId) {
    throw new Error(
      'Conta sem late_account_id. Reconecte via UI Late/Zernio (Integrações → Conectar).',
    );
  }

  let finalMediaItems: Array<{ type: string; url: string; order?: number }> = [];
  if (inputMediaItems && inputMediaItems.length > 0) {
    finalMediaItems = inputMediaItems.map((m, i) => ({
      type: m.type || (m.url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image'),
      url: m.url,
      order: i,
    }));
  } else if (mediaUrls && mediaUrls.length > 0) {
    finalMediaItems = mediaUrls.map((url, i) => ({
      type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
      url,
      order: i,
    }));
  }

  const publishNow = !scheduledFor;
  const postPayload: Record<string, unknown> = { publishNow };
  if (scheduledFor) postPayload.scheduledFor = scheduledFor;

  if (threadItems && threadItems.length > 0 && (platform === 'twitter' || platform === 'threads')) {
    const lateThreadItems = threadItems.map((item, i) => ({
      content: item.text,
      order: i,
      ...(item.media_urls?.length
        ? {
            mediaItems: item.media_urls.map((url, j) => ({
              type: url.match(/\.(mp4|mov|webm|avi)$/i) ? 'video' : 'image',
              url,
              order: j,
            })),
          }
        : {}),
    }));
    postPayload.platforms = [
      {
        platform,
        accountId: lateAccountId,
        platformSpecificData: { threadItems: lateThreadItems },
      },
    ];
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
      if (igOpts.trialReel) platformSpecificData.trialReel = igOpts.trialReel;
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

  console.log('[publishViaLate]', { platform, lateAccountId, publishNow, planningItemId });

  const lateRes = await fetch(`${LATE_API_BASE}/v1/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json',
    },
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
  try {
    postData = JSON.parse(responseText);
  } catch {
    postData = { message: 'Publicado com sucesso' };
  }

  const publishedUrl =
    postData.post?.platforms?.[0]?.platformPostUrl ||
    postData.post?.platforms?.[0]?.publishedUrl ||
    postData.post?.url ||
    null;
  const postId = postData.post?._id || postData.postId || null;
  const newStatus: 'published' | 'scheduled' = publishNow ? 'published' : 'scheduled';

  if (planningItemId) {
    const pool = getPool();
    const currentItem = await queryOne<any>(
      `SELECT metadata, workspace_id FROM planning_items WHERE id = $1`,
      [planningItemId],
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

    const fields = [
      'status = $1',
      'error_message = NULL',
      'updated_at = NOW()',
      'external_post_id = $2',
      'metadata = $3::jsonb',
    ];
    const values: any[] = [newStatus, postId, JSON.stringify(newMetadata)];
    if (publishNow) fields.push(`published_at = NOW()`);
    values.push(planningItemId);
    await pool.query(
      `UPDATE planning_items SET ${fields.join(', ')} WHERE id = $${values.length}`,
      values,
    );
  }

  return {
    success: true,
    postId,
    status: newStatus,
    url: publishedUrl,
    platform,
    message: publishNow
      ? `Publicado em ${platform}!`
      : `Agendado para ${new Date(scheduledFor!).toLocaleString('pt-BR')}`,
  };
}
