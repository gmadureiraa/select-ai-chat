/**
 * full-client-context — agregador cacheado de TUDO que o copywriter precisa
 * pra gerar conteúdo no tom do cliente, sem perder request budget revalidando
 * a cada chamada.
 *
 * Compõe (em paralelo):
 *   - `getClientContextServer` → brand, tone, pillars, persona, audience,
 *     keywords, competitors, identity_guide, websites, documents, visual refs,
 *     contentLibrary, referenceLibrary.
 *   - `getTopPerformingContent` → top 5 posts ranqueados pela view
 *     `client_top_content` (engagement DESC últimos 6m). Usados como few-shots.
 *   - `findSimilarContent` (opcional) → similarity search via pgvector na
 *     contentLibrary, quando o caller passa `queryText` (briefing do user).
 *
 * Cache:
 *   - In-memory Map por clientId, TTL 5min. KAI Chat geralmente faz várias
 *     chamadas em sequência (1 conversa = N tools), e revalidar o mesmo
 *     contexto 5x desperdiça ~800ms cada.
 *   - `queryText` NÃO entra na chave de cache: similarity search é re-feita
 *     sempre que `query` passado, pra capturar refs relevantes pra cada briefing.
 *   - `invalidateCachedClientContext()` pode ser chamado quando o frontend
 *     edita o cliente (updateClient tool, brand-analysis handler).
 */

import {
  getClientContextServer,
  findSimilarContent,
  getTopPerformingContent,
  type ClientContext,
  type ClientContentLibraryRow,
} from './client-context.js';

export interface FullClientContext {
  /** Contexto core devolvido por `getClientContextServer`. */
  ctx: ClientContext;
  /** Top performers ranqueados pela view. Vazio se view não existe ainda. */
  topPerformers: Array<{
    id: string;
    title: string;
    content: string;
    engagement_score: number;
    rank: number;
  }>;
  /** Posts similares ao queryText (similarity search). Vazio se sem query. */
  similar: Array<{
    id: string;
    title: string;
    content: string;
    similarity: number;
    engagement_score: number;
  }>;
  /** Posts mais recentes da contentLibrary (fallback quando topPerformers vazio). */
  recentLibrary: ClientContentLibraryRow[];
  /** Plataformas preferidas detectadas no histórico de posts. */
  platformPreferences: PlatformPreference[];
  /** Timestamp em ms da geração (pra debug). */
  loadedAt: number;
}

export interface PlatformPreference {
  platform: string;
  postsCount: number;
  avgHashtags: number;
  avgLengthChars: number;
}

// ─── Cache ──────────────────────────────────────────────────────────────

interface CacheEntry {
  fullCtx: Omit<FullClientContext, 'similar'>;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export function invalidateCachedClientContext(clientId?: string): void {
  if (!clientId) {
    CACHE.clear();
    return;
  }
  CACHE.delete(clientId);
}

// ─── Loader ─────────────────────────────────────────────────────────────

/**
 * Carrega contexto completo do cliente. Usa cache de 5min por clientId.
 *
 * @param clientId — UUID do cliente.
 * @param queryText — Briefing/pedido do user. Quando presente, dispara
 *                    similarity search adicional na contentLibrary.
 */
export async function getFullClientContext(
  clientId: string,
  queryText?: string,
): Promise<FullClientContext | null> {
  if (!clientId) return null;

  const cached = CACHE.get(clientId);
  const now = Date.now();
  let baseFullCtx: Omit<FullClientContext, 'similar'> | null = null;

  if (cached && cached.expiresAt > now) {
    baseFullCtx = cached.fullCtx;
  } else {
    const [ctx, topPerformers] = await Promise.all([
      getClientContextServer(clientId).catch((err) => {
        console.warn('[getFullClientContext] ctx load failed:', err);
        return null;
      }),
      getTopPerformingContent(clientId, 5).catch(() => []),
    ]);

    if (!ctx) return null;

    const recentLibrary = ctx.contentLibrary.slice(0, 5);
    const platformPreferences = analyzePlatformPreferences(ctx.contentLibrary);

    baseFullCtx = {
      ctx,
      topPerformers,
      recentLibrary,
      platformPreferences,
      loadedAt: now,
    };
    CACHE.set(clientId, { fullCtx: baseFullCtx, expiresAt: now + TTL_MS });
  }

  // Similarity search é per-call (não cacheado) — depende do queryText.
  let similar: FullClientContext['similar'] = [];
  if (queryText && queryText.trim().length > 0) {
    try {
      similar = await findSimilarContent(clientId, queryText, 3);
    } catch (err) {
      console.warn('[getFullClientContext] similarity search failed:', err);
    }
  }

  return { ...baseFullCtx, similar };
}

// ─── Platform preferences (puro, sem I/O) ──────────────────────────────

const HASHTAG_REGEX = /#[\p{L}0-9_]+/gu;

/**
 * Analisa contentLibrary pra derivar preferências por plataforma:
 *   - posts contagem por plataforma
 *   - hashtags médias (pra calibrar quantas adicionar no novo)
 *   - tamanho médio (pra calibrar verbosidade)
 *
 * Útil pra: "esse cliente usa LinkedIn raro mas Twitter constante" → ajustar
 * o briefing do gerador conforme a cadência real.
 */
export function analyzePlatformPreferences(
  rows: ClientContentLibraryRow[],
): PlatformPreference[] {
  const buckets = new Map<
    string,
    { count: number; totalHashtags: number; totalLength: number }
  >();
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const platform = String(
      meta.platform ?? meta.network ?? row.content_type ?? 'unknown',
    ).toLowerCase();
    const content = row.content ?? '';
    const hashtagCount = (content.match(HASHTAG_REGEX) ?? []).length;
    const existing = buckets.get(platform) ?? {
      count: 0,
      totalHashtags: 0,
      totalLength: 0,
    };
    existing.count += 1;
    existing.totalHashtags += hashtagCount;
    existing.totalLength += content.length;
    buckets.set(platform, existing);
  }
  return Array.from(buckets.entries())
    .map(([platform, b]) => ({
      platform,
      postsCount: b.count,
      avgHashtags: b.count > 0 ? b.totalHashtags / b.count : 0,
      avgLengthChars: b.count > 0 ? b.totalLength / b.count : 0,
    }))
    .sort((a, b) => b.postsCount - a.postsCount);
}

// ─── Few-shot formatters ───────────────────────────────────────────────

/**
 * Formata top performers + similar como bloco "few-shot examples" pra injetar
 * no system prompt. Cabe ser concatenado depois de `buildClientHistoricalReferences`
 * pra dar contexto adicional específico.
 */
export function buildFewShotExamples(
  full: FullClientContext,
  platform: string,
): string {
  const pool = [
    ...full.similar.map((s) => ({
      title: s.title,
      content: s.content,
      tag: `similar ${(s.similarity * 100).toFixed(0)}%`,
    })),
    ...full.topPerformers.map((t) => ({
      title: t.title,
      content: t.content,
      tag: `top performer (rank ${t.rank})`,
    })),
  ];

  if (pool.length === 0) return '';

  // Dedupe por content (similar e top performer podem coincidir)
  const seen = new Set<string>();
  const dedup = pool.filter((p) => {
    const key = p.content.slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const slice = dedup.slice(0, 3);
  const parts: string[] = [];
  parts.push(`## EXEMPLOS DESTE CLIENTE NA PLATAFORMA ${platform.toUpperCase()}`);
  parts.push(
    'Estes são posts reais top-performing do cliente. Mantenha esse tom, estrutura e densidade. **Não copie** — extraia o padrão.',
  );
  slice.forEach((p, i) => {
    const trimmed =
      p.content.length > 600 ? p.content.slice(0, 600) + '...' : p.content;
    parts.push(`\n### Exemplo ${i + 1} (${p.tag}) — ${p.title || 'sem título'}\n${trimmed}`);
  });
  return parts.join('\n');
}

/**
 * Resumo conciso de plataforma preferences pra injetar no prompt:
 * "Cliente posta MUITO no LinkedIn (12 posts, hashtags=0 em média)..."
 */
export function buildPlatformPreferenceHint(
  full: FullClientContext,
  platform: string,
): string {
  const target = full.platformPreferences.find(
    (p) => p.platform === platform.toLowerCase(),
  );
  if (!target) return '';
  const parts: string[] = [];
  parts.push(
    `## CADÊNCIA HISTÓRICA NA PLATAFORMA ${platform.toUpperCase()}`,
  );
  parts.push(
    `Cliente tem ${target.postsCount} post(s) registrado(s) nessa plataforma.`,
  );
  parts.push(
    `Média de hashtags por post: ${target.avgHashtags.toFixed(1)} (use o mesmo padrão; LinkedIn idealmente 0).`,
  );
  parts.push(
    `Tamanho médio: ~${Math.round(target.avgLengthChars)} caracteres. Mantenha verbosidade compatível.`,
  );
  return parts.join('\n');
}
