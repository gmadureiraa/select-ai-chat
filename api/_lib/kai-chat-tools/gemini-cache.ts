/**
 * Gemini Cached Content helper — in-memory LRU + TTL.
 *
 * Por que: system instruction (5-10KB) + tool declarations (~20KB) repetem
 * idêntico em TODA iteração do runToolLoop e entre conversas do mesmo cliente.
 * Pagar input token 100% de novo em cada chamada quando cached content desconta
 * 75% é desperdício direto.
 *
 * Gemini Caching API requer mínimo de tokens (1024 Flash, 4096 Pro). Se o conteúdo
 * for menor, retorna 400 — fallback graceful pra sem cache.
 *
 * In-memory pra evitar migration extra. Cada Vercel function fica warm ~5-10min,
 * então mesmo sem persistência o hit-rate é razoável dentro de uma sessão. Pra
 * persistência cross-region/cross-cold-start, daria pra mover pra Redis (Upstash
 * já configurado pro rate-limit) ou Postgres em fase 2.
 */
import { createHash } from 'node:crypto';
import type { ToolDefinition } from './types.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface CacheEntry {
  /** Resource name retornado pelo Gemini, ex: "cachedContents/abc123" */
  name: string;
  /** Expira em (ms epoch). Renovação NÃO é automática; recriamos. */
  expiresAt: number;
  /** Modelo associado ao cache (cache é por-modelo, não compartilhável). */
  model: string;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 256;

/** Modelo mínimo de tokens pra criar cached content (Gemini docs 2026). */
const MIN_CACHE_TOKENS: Record<string, number> = {
  'gemini-2.5-flash': 1024,
  'gemini-2.5-flash-lite': 1024,
  'gemini-2.5-pro': 4096,
  'gemini-2.0-flash': 1024,
};

function minTokensFor(model: string): number {
  const base = model.replace(/^google\//, '').split('-preview')[0];
  return MIN_CACHE_TOKENS[base] ?? 4096;
}

/** Aproxima tokens via chars/4 — bate com a heurística do ai-usage.ts */
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt <= now) cache.delete(k);
  }
  if (cache.size > MAX_ENTRIES) {
    const overflow = cache.size - MAX_ENTRIES;
    const iter = cache.keys();
    for (let i = 0; i < overflow; i++) {
      const k = iter.next().value;
      if (k) cache.delete(k);
    }
  }
}

function makeKey(model: string, systemInstruction: string, tools: ToolDefinition[]): string {
  const hash = createHash('sha256');
  hash.update(model);
  hash.update('\x00');
  hash.update(systemInstruction);
  hash.update('\x00');
  hash.update(JSON.stringify(tools));
  return hash.digest('hex');
}

export interface GetOrCreateCacheOpts {
  apiKey: string;
  model: string;
  systemInstruction: string;
  tools: ToolDefinition[];
  /** Time-to-live em segundos. Default 900 (15min). Máx prático 3600 sem billing extra. */
  ttlSeconds?: number;
}

export interface CacheLookupResult {
  /** Resource name pra passar como `cachedContent` no body do generateContent. */
  cacheName: string | null;
  /** True se a entry veio do hit-cache. False se foi recém-criada ou inviável. */
  hit: boolean;
  /** Motivo de bypass quando cacheName=null, pra log. */
  reason?: 'too_small' | 'api_error' | 'disabled';
}

/**
 * Lookup ou cria CachedContent no Gemini. Sempre retorna — null se inviável
 * (conteúdo pequeno demais, erro da API, model não suportado). Caller usa
 * cacheName quando não-null e ignora quando null (fallback transparente pro
 * fluxo sem cache).
 */
export async function getOrCreateGeminiCache(
  opts: GetOrCreateCacheOpts,
): Promise<CacheLookupResult> {
  if (process.env.KAI_GEMINI_CACHE_DISABLED === '1') {
    return { cacheName: null, hit: false, reason: 'disabled' };
  }
  const { apiKey, model, systemInstruction, tools, ttlSeconds = 900 } = opts;
  if (!apiKey) return { cacheName: null, hit: false, reason: 'disabled' };

  evictExpired();

  const totalTokens =
    approxTokens(systemInstruction) + approxTokens(JSON.stringify(tools));
  if (totalTokens < minTokensFor(model)) {
    return { cacheName: null, hit: false, reason: 'too_small' };
  }

  const key = makeKey(model, systemInstruction, tools);
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now() + 5000) {
    // refresh LRU order
    cache.delete(key);
    cache.set(key, existing);
    return { cacheName: existing.name, hit: true };
  }

  try {
    const url = `${GEMINI_API_BASE}/cachedContents?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${model.replace(/^google\//, '')}`,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ functionDeclarations: tools }],
        ttl: `${ttlSeconds}s`,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      if (resp.status === 400) {
        // Provavelmente min-tokens não atingido ou model sem cache support
        console.log(
          `[gemini-cache] skip create (status ${resp.status}): ${txt.slice(0, 200)}`,
        );
        return { cacheName: null, hit: false, reason: 'too_small' };
      }
      console.warn(
        `[gemini-cache] create failed (${resp.status}): ${txt.slice(0, 300)}`,
      );
      return { cacheName: null, hit: false, reason: 'api_error' };
    }

    const data = (await resp.json()) as { name?: string };
    if (!data.name) return { cacheName: null, hit: false, reason: 'api_error' };

    cache.set(key, {
      name: data.name,
      expiresAt: Date.now() + ttlSeconds * 1000,
      model,
    });
    return { cacheName: data.name, hit: false };
  } catch (err) {
    console.warn('[gemini-cache] unexpected error:', err);
    return { cacheName: null, hit: false, reason: 'api_error' };
  }
}

/** Stats pra dashboard/observability. Snapshot leve. */
export function getCacheStats(): { size: number; entries: number; oldestExpiresIn: number } {
  evictExpired();
  let oldest = Infinity;
  for (const v of cache.values()) {
    if (v.expiresAt < oldest) oldest = v.expiresAt;
  }
  return {
    size: cache.size,
    entries: cache.size,
    oldestExpiresIn: oldest === Infinity ? 0 : Math.max(0, oldest - Date.now()),
  };
}

/** Pra testes ou rotação manual. */
export function clearGeminiCache(): void {
  cache.clear();
}
