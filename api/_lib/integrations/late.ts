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
  // 2026-05-18: alinhar com SUPPORTED_PLATFORMS de process-scheduled-posts.ts.
  // Pinterest e Bluesky são suportados pela Late mas sem platformSpecificData
  // especial — caem no else genérico (texto + mediaItems).
  'pinterest',
  'bluesky',
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
  platformOptions?: PlatformOptions;
}

export interface PublishViaLateResult {
  success: boolean;
  postId: string | null;
  status: 'published' | 'scheduled';
  url: string | null;
  platform: string;
  message: string;
}

type JsonRecord = Record<string, unknown>;
export type PlatformOptions = Partial<Record<'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube', JsonRecord>>;
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

  const igOpts = asRecord(platformOptions?.instagram);
  const fbOpts = asRecord(platformOptions?.facebook);
  const liOpts = asRecord(platformOptions?.linkedin);
  const ttOpts = asRecord(platformOptions?.tiktok);
  const ytOpts = asRecord(platformOptions?.youtube);
  let content = rawContent;
  const instagramCaption = stringOpt(igOpts, 'customCaption');
  const facebookCaption = stringOpt(fbOpts, 'customCaption');
  if (platform === 'instagram' && instagramCaption) content = instagramCaption;
  else if (platform === 'facebook' && facebookCaption) content = facebookCaption;

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

  const credentials = await queryOne<LateCredential>(
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

  const meta = asRecord(credentials.metadata);
  const lateAccountId = stringOpt(meta, 'late_account_id') || credentials.account_id;
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
      platformSpecificData.privacy_level = stringOpt(ttOpts, 'privacyLevel') || 'PUBLIC_TO_EVERYONE';
      // Title: prefer explicit opts.title, senão deriva do content (cap 150).
      const ttTitle = stringOpt(ttOpts, 'title');
      if (ttTitle) platformSpecificData.title = ttTitle.substring(0, 150);
      else if (content.length > 150) platformSpecificData.title = content.substring(0, 147) + '...';
      // TikTok carousel (photo mode 2026): se todos os mediaItems forem imagens
      // e tiver 2+, Late infere photo carousel. Forçamos disableDuet/disableComment
      // só se vier explícito pra não sobrescrever defaults do user.
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
      if (ytDescription) {
        platformSpecificData.description = ytDescription;
      } else if (lines.length > 1) {
        platformSpecificData.description = lines.slice(1).join('\n');
      }
      const madeForKids = boolOpt(ytOpts, 'madeForKids');
      const categoryId = stringOpt(ytOpts, 'categoryId');
      if (madeForKids !== undefined) platformSpecificData.madeForKids = madeForKids;
      if (categoryId) platformSpecificData.categoryId = categoryId;
      // YouTube Shorts são detectados pela Late via aspect ratio vertical do
      // mediaItem (≤60s + 9:16). Não precisa flag explícita.
    }

    if (platform === 'instagram') {
      // Se o caller passou contentType explícito, respeita. Senão tenta inferir
      // pelos mediaItems pra não depender da Late auto-detectar:
      //   - 0 imagens (text-only) → impossível IG, Late vai falhar antes
      //   - 1 imagem → 'post' (single static)
      //   - 1 vídeo → 'reels' (Reels)
      //   - 2+ items mistos → 'carousel'
      let igContentType = stringOpt(igOpts, 'contentType');
      if (!igContentType && finalMediaItems.length > 0) {
        if (finalMediaItems.length >= 2) igContentType = 'carousel';
        else if (finalMediaItems[0].type === 'video') igContentType = 'reels';
        else igContentType = 'post';
      }
      if (igContentType) {
        platformSpecificData.contentType = igContentType;
        // Reels-only opts (shareToFeed, trialReel, audioName) só fazem sentido
        // quando contentType === 'reels'. Late ignora se mandar fora desse caso.
        if (igContentType === 'reels') {
          const shareToFeed = boolOpt(igOpts, 'shareToFeed');
          const trialReel = boolOpt(igOpts, 'trialReel');
          const audioName = stringOpt(igOpts, 'audioName');
          if (shareToFeed !== undefined) platformSpecificData.shareToFeed = shareToFeed;
          if (trialReel !== undefined) platformSpecificData.trialReel = trialReel;
          if (audioName) platformSpecificData.audioName = audioName;
        }
        // firstComment funciona pra post/carousel/reels.
        const firstComment = stringOpt(igOpts, 'firstComment');
        if (firstComment) platformSpecificData.firstComment = firstComment;
      }
    }

    if (platform === 'facebook') {
      // Mesma lógica do IG: infere contentType pelos mediaItems se não vier
      // explícito. Late aceita 'post' / 'reels' / 'story' pra Facebook.
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
      // LinkedIn carousel = PDF document upload (formato oficial do LI desde
      // 2023). Quando o caller manda format='pdf-document' explícito (ou o
      // único mediaItem é .pdf), forçamos a Late a usar o endpoint de document.
      const onlyMediaIsPdf =
        finalMediaItems.length === 1 && /\.pdf(\?|$)/i.test(finalMediaItems[0].url);
      const isCarouselPdf = stringOpt(liOpts, 'format') === 'pdf-document' || onlyMediaIsPdf;
      if (isCarouselPdf) {
        platformSpecificData.format = 'pdf-document';
        const liTitle = stringOpt(liOpts, 'title');
        if (liTitle) platformSpecificData.title = liTitle.substring(0, 100);
      }
      const visibility = stringOpt(liOpts, 'visibility');
      if (visibility) platformSpecificData.visibility = visibility; // 'PUBLIC' | 'CONNECTIONS'
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
    } catch {
      // Late sometimes returns plain text/HTML for upstream failures.
    }
    throw new Error(userMessage);
  }

  const postData = parseLateResponse(responseText);

  const publishedUrl =
    postData.post?.platforms?.[0]?.platformPostUrl ||
    postData.post?.platforms?.[0]?.publishedUrl ||
    postData.post?.url ||
    null;
  const postId = postData.post?._id || postData.postId || null;
  const newStatus: 'published' | 'scheduled' = publishNow ? 'published' : 'scheduled';

  if (planningItemId) {
    const pool = getPool();
    const currentItem = await queryOne<{ metadata: unknown; workspace_id: string }>(
      `SELECT metadata, workspace_id
         FROM planning_items
        WHERE id = $1
          AND client_id = $2
        LIMIT 1`,
      [planningItemId, clientId],
    );
    if (!currentItem) {
      console.warn('[publishViaLate] planning item skipped: id/client mismatch', {
        planningItemId,
        clientId,
      });
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
    const existingMetadata = asRecord(currentItem.metadata);
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

    const fields = [
      'status = $1',
      'error_message = NULL',
      'updated_at = NOW()',
      'external_post_id = $2',
      'metadata = $3::jsonb',
    ];
    const values: unknown[] = [newStatus, postId, JSON.stringify(newMetadata)];
    if (publishNow) fields.push(`published_at = NOW()`);
    values.push(planningItemId);
    values.push(clientId);
    await pool.query(
      `UPDATE planning_items SET ${fields.join(', ')}
        WHERE id = $${values.length - 1}
          AND client_id = $${values.length}`,
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
