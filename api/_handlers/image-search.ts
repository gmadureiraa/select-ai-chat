// Migrated from supabase/functions/image-search/index.ts
import { anonPost } from '../_lib/handler.js';

interface NormalizedImage {
  id: string;
  url: string;
  thumbnail: string;
  attribution: string;
  sourceUrl: string;
  source: 'openverse' | 'pexels';
}

async function searchOpenverse(query: string, perPage: number): Promise<NormalizedImage[]> {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(perPage));
  url.searchParams.set('license_type', 'all');
  const r = await fetch(url.toString(), {
    headers: { 'User-Agent': 'KaiViralSequence/1.0 (kaleidos.com.br)', Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Openverse ${r.status}`);
  const data = await r.json();
  const results = (data.results ?? []) as Array<any>;
  return results.map((r) => ({
    id: `ov_${r.id}`,
    url: r.url,
    thumbnail: r.thumbnail || r.url,
    attribution: [r.creator, r.license ? `(${r.license.toUpperCase()})` : ''].filter(Boolean).join(' '),
    sourceUrl: r.foreign_landing_url || r.url,
    source: 'openverse' as const,
  }));
}

async function searchPexels(query: string, perPage: number): Promise<NormalizedImage[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error('PEXELS_API_KEY não configurada');
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('orientation', 'landscape');
  const r = await fetch(url.toString(), { headers: { Authorization: apiKey } });
  if (!r.ok) throw new Error(`Pexels ${r.status}`);
  const data = await r.json();
  const photos = (data.photos ?? []) as Array<any>;
  return photos.map((p) => ({
    id: `px_${p.id}`,
    url: p.src.large,
    thumbnail: p.src.medium,
    attribution: `Foto: ${p.photographer} (Pexels)`,
    sourceUrl: p.url,
    source: 'pexels' as const,
  }));
}

export default anonPost(async ({ body }) => {
  const query = (body?.query ?? '').trim();
  if (!query) throw new Error('query é obrigatória');
  const perPage = Math.min(Math.max(body?.perPage ?? 12, 1), 24);
  const source = body?.source ?? 'openverse';

  let items: NormalizedImage[] = [];
  let usedSource: 'openverse' | 'pexels' = source;

  if (source === 'pexels') {
    try {
      items = await searchPexels(query, perPage);
    } catch (err) {
      console.warn('[image-search] Pexels falhou, fallback p/ Openverse:', err);
      items = await searchOpenverse(query, perPage);
      usedSource = 'openverse';
    }
  } else {
    items = await searchOpenverse(query, perPage);
  }
  return { items, source: usedSource };
});
