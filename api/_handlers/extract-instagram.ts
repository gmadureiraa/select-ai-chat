// Migrated from supabase/functions/extract-instagram/index.ts
// Storage migrated 2026-05-08 → Vercel Blob (era Supabase Storage legacy).
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { put } from '@vercel/blob';

const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[a-zA-Z0-9_-]+\/?/;

const BodySchema = z.object({
  url: z
    .string()
    .url('URL do Instagram é obrigatória')
    .regex(instagramRegex, 'URL inválida. Use um link de post ou reel do Instagram.'),
  clientId: z.string().min(1).optional(),
  uploadToStorage: z.boolean().optional(),
});

export default authedPost(async ({ body }) => {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Invalid input: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }
  const { url, clientId, uploadToStorage } = parsed.data;
  const apifyApiKey = process.env.APIFY_API_KEY_INSTAGRAM || process.env.APIFY_API_KEY;
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
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      console.warn('[extract-instagram] BLOB_READ_WRITE_TOKEN missing; skip upload');
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
          const blob = await put(blobPath, Buffer.from(arrayBuffer), {
            access: 'public',
            contentType,
            addRandomSuffix: false,
            allowOverwrite: true,
            token: blobToken,
          });
          uploadedPaths.push(blobPath);
          uploadedUrls.push(blob.url);
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
