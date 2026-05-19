// Migrated from supabase/functions/extract-instagram/index.ts
// Storage migrated 2026-05-08 → Vercel Blob (era Supabase Storage legacy).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { putObject } from '../_lib/r2.js';
import { assertClientAccess } from '../_lib/access.js';
import { rateLimit, getRateLimitKey } from '../_lib/shared/rate-limit.js';

function withStatus(err: Error, status: number): Error {
  (err as any).status = status;
  (err as any).statusCode = status;
  return err;
}

const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[a-zA-Z0-9_-]+\/?/;

const BodySchema = z.object({
  url: z
    .string()
    .url('URL do Instagram é obrigatória')
    .regex(instagramRegex, 'URL inválida. Use um link de post ou reel do Instagram.'),
  clientId: z.string().min(1).optional(),
  uploadToStorage: z.boolean().optional(),
});

export default authedPost(async ({ body, user, req, res }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Invalid input: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }
  const { url, clientId, uploadToStorage } = parsed.data;
  if (clientId) await assertClientAccess(user.id, clientId);

  // Rate limit: cap 30/min — Apify hard-limit por conta + cost per call.
  const rlKey = getRateLimitKey(req, 'extract-instagram', user.id);
  const rl = await rateLimit({ key: rlKey, limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    throw withStatus(new Error(`Rate limit excedido (30/min). Tente em ${rl.retryAfterSec}s.`), 429);
  }
  const apifyApiKey = (process.env.APIFY_API_KEY_INSTAGRAM || process.env.APIFY_API_KEY || '')
    .replace(/\\n/g, '')
    .trim();
  if (!apifyApiKey) throw new Error('APIFY_API_KEY_INSTAGRAM not configured');

  console.log('Extracting Instagram post:', url);

  const apifyResponse = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directUrls: [url], resultsType: 'posts', resultsLimit: 1 }),
    }
  );
  if (!apifyResponse.ok) {
    const errorText = await apifyResponse.text();
    console.error('Apify API error:', apifyResponse.status, errorText);
    const isLimitExceeded = errorText.includes('hard limit exceeded') || apifyResponse.status === 403;
    return {
      error: isLimitExceeded
        ? 'Limite de uso da API de extração atingido. Tente novamente mais tarde.'
        : 'Erro ao extrair imagens do Instagram. Tente novamente.',
      fallback: true,
    };
  }
  const data = await apifyResponse.json();
  if (!data || data.length === 0) {
    return { error: 'Não foi possível extrair as imagens. O post pode estar privado ou indisponível.' };
  }
  const post = data[0];
  const images: string[] = [];
  const imageFields = ['displayUrl', 'display_url', 'imageUrl', 'image_url', 'image', 'thumbnailSrc', 'thumbnail_src', 'previewUrl'];
  for (const f of imageFields) if (post[f] && typeof post[f] === 'string') images.push(post[f]);
  for (const f of ['images', 'mediaUrls', 'media_urls']) {
    if (post[f] && Array.isArray(post[f])) images.push(...post[f].filter((u: unknown) => typeof u === 'string'));
  }
  for (const f of ['childPosts', 'sidecarChildren', 'carousel_media', 'carouselMedia']) {
    if (post[f] && Array.isArray(post[f])) {
      for (const child of post[f]) {
        for (const img of imageFields) if (child[img]) images.push(child[img]);
      }
    }
  }
  const uniqueImages = [...new Set(images)];
  if (uniqueImages.length === 0) {
    return { error: 'Nenhuma imagem encontrada neste post.', postKeys: Object.keys(post) };
  }

  const uploadedPaths: string[] = [];
  const uploadedUrls: string[] = [];
  if (uploadToStorage && clientId) {
    // 2026-05-19: storage agora é R2 (Blob suspenso).
    if (!process.env.R2_BUCKET || !process.env.R2_PUBLIC_URL) {
      console.warn('[extract-instagram] R2 env missing; skip upload');
    } else {
      for (let i = 0; i < uniqueImages.length; i++) {
        const imageUrl = uniqueImages[i];
        try {
          const imgResponse = await fetch(imageUrl);
          if (!imgResponse.ok) continue;
          const arrayBuffer = await imgResponse.arrayBuffer();
          const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
          const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg';
          const ts = Date.now();
          const blobPath = `instagram-sync/${clientId}/${ts}-${i}.${extension}`;
          // 2026-05-19: migrado de Vercel Blob → R2.
          const r = await putObject(blobPath, Buffer.from(arrayBuffer), contentType);
          uploadedPaths.push(r.key);
          uploadedUrls.push(r.url);
        } catch (e) {
          console.warn(`Error processing image ${i}:`, e);
        }
      }
    }
  }

  return {
    images: uniqueImages,
    uploadedPaths,
    uploadedUrls,
    caption: post.caption || '',
    imageCount: uniqueImages.length,
  };
});
