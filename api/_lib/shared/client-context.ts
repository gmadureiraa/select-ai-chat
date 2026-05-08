// =====================================================
// CLIENT CONTEXT — server-side aggregator for multi-tenant viral apps
// =====================================================
// Reads ALL relevant rows for a given client_id and shapes them into the
// `ClientContext` payload consumed by:
//   - `generate-viral-carousel` (Sequência Viral)
//   - `adapt-viral-reel` (Reels Viral)
//   - `kai-content-agent` (KAI chat content gen)
//   - `cron-generate-daily-brief` (Radar per-client briefs)
//   - GET /api/client-context endpoint (frontend simulation)
//
// Mirrors the shape of the `useClientContext` hook in `src/hooks/useClientContext.ts`
// so client and server have a single source of truth.

import { query, queryOne } from '../db.js';
import { generateEmbedding, toVectorLiteral } from './embeddings.js';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ClientRow {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  identity_guide: string | null;
  context_notes: string | null;
  voice_profile: Record<string, unknown> | null;
  social_media: Record<string, unknown> | null;
  tags: Record<string, unknown> | null;
  workspace_id: string;
  user_id: string | null;
  avatar_url: string | null;
}

export interface ClientPreferenceRow {
  id: string;
  client_id: string;
  preference_type: string;
  preference_value: string;
  confidence: number | null;
  created_at: string | null;
}

export interface ClientWebsiteRow {
  id: string;
  client_id: string;
  url: string;
  scraped_markdown: string | null;
  scraped_content: string | null;
  last_scraped_at: string | null;
}

export interface ClientDocumentRow {
  id: string;
  client_id: string;
  name: string;
  file_path: string;
  file_type: string;
  extracted_content: string | null;
  created_at: string | null;
}

export interface ClientVisualReferenceRow {
  id: string;
  client_id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  reference_type: string;
  is_primary: boolean | null;
  metadata: Record<string, unknown> | null;
}

export interface ClientContentLibraryRow {
  id: string;
  client_id: string;
  title: string;
  content: string;
  content_type: string;
  content_url: string | null;
  thumbnail_url: string | null;
  is_favorite: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ClientReferenceLibraryRow {
  id: string;
  client_id: string;
  title: string;
  content: string;
  reference_type: string;
  source_url: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ClientViralCompetitorRow {
  id: string;
  client_id: string;
  handle: string;
  platform: string;
  notes: string | null;
}

export interface ClientViralKeywordRow {
  id: string;
  client_id: string;
  keyword: string;
}

export interface ClientContext {
  client: ClientRow;
  tone: string | null;
  pillars: string[];
  persona: {
    age: string | null;
    pain: string | null;
    goal: string | null;
  };
  brand: {
    do: string[];
    dont: string[];
  };
  audience: string[];
  websites: ClientWebsiteRow[];
  documents: ClientDocumentRow[];
  visualReferences: ClientVisualReferenceRow[];
  contentLibrary: ClientContentLibraryRow[];
  referenceLibrary: ClientReferenceLibraryRow[];
  competitors: ClientViralCompetitorRow[];
  keywords: ClientViralKeywordRow[];
  preferences: ClientPreferenceRow[];
}

// ─── Decoders ───────────────────────────────────────────────────────────

interface DecodeRaw {
  client: ClientRow | null;
  prefs: ClientPreferenceRow[];
  websites: ClientWebsiteRow[];
  documents: ClientDocumentRow[];
  visualReferences: ClientVisualReferenceRow[];
  contentLibrary: ClientContentLibraryRow[];
  referenceLibrary: ClientReferenceLibraryRow[];
  competitors: ClientViralCompetitorRow[];
  keywords: ClientViralKeywordRow[];
}

/**
 * Pure decoder — turns parallel raw rows into a `ClientContext`.
 * Exported so the React-side hook can use the exact same logic.
 */
export function decodeClientContext(raw: DecodeRaw): ClientContext | null {
  if (!raw.client) return null;

  const tone =
    raw.prefs.find((p) => p.preference_type === 'tone')?.preference_value ?? null;
  const pillars = raw.prefs
    .filter((p) => p.preference_type === 'content_pillar')
    .map((p) => p.preference_value);
  const persona = {
    age:
      raw.prefs.find((p) => p.preference_type === 'persona_age')?.preference_value ?? null,
    pain:
      raw.prefs.find((p) => p.preference_type === 'persona_pain')?.preference_value ?? null,
    goal:
      raw.prefs.find((p) => p.preference_type === 'persona_goal')?.preference_value ?? null,
  };
  const brand = {
    do: raw.prefs
      .filter((p) => p.preference_type === 'brand_do')
      .map((p) => p.preference_value),
    dont: raw.prefs
      .filter((p) => p.preference_type === 'brand_dont')
      .map((p) => p.preference_value),
  };
  const audience = raw.prefs
    .filter((p) => p.preference_type === 'target_audience')
    .map((p) => p.preference_value);

  return {
    client: raw.client,
    tone,
    pillars,
    persona,
    brand,
    audience,
    websites: raw.websites,
    documents: raw.documents,
    visualReferences: raw.visualReferences,
    contentLibrary: raw.contentLibrary,
    referenceLibrary: raw.referenceLibrary,
    competitors: raw.competitors,
    keywords: raw.keywords,
    preferences: raw.prefs,
  };
}

// ─── Loader ─────────────────────────────────────────────────────────────

const SELECT_CLIENT = `SELECT
  id, name, description,
  COALESCE(tags->>'segment', tags->>'industry') AS industry,
  identity_guide, context_notes, voice_profile, social_media, tags,
  workspace_id, user_id, avatar_url
FROM clients WHERE id = $1`;

/**
 * Server-side aggregator. Runs 8 queries in parallel and returns the
 * `ClientContext` shape. Returns `null` when the client doesn't exist.
 */
export async function getClientContextServer(
  clientId: string
): Promise<ClientContext | null> {
  if (!clientId) return null;

  const [
    client,
    prefs,
    websites,
    documents,
    visualReferences,
    contentLibrary,
    referenceLibrary,
    competitors,
    keywords,
  ] = await Promise.all([
    queryOne<ClientRow>(SELECT_CLIENT, [clientId]).catch(() => null),
    query<ClientPreferenceRow>(
      `SELECT id, client_id, preference_type, preference_value, confidence, created_at
         FROM client_preferences
        WHERE client_id = $1
        ORDER BY confidence DESC NULLS LAST, created_at DESC`,
      [clientId]
    ).catch(() => []),
    query<ClientWebsiteRow>(
      `SELECT id, client_id, url, scraped_markdown, scraped_content, last_scraped_at
         FROM client_websites
        WHERE client_id = $1
        ORDER BY last_scraped_at DESC NULLS LAST
        LIMIT 10`,
      [clientId]
    ).catch(() => []),
    query<ClientDocumentRow>(
      `SELECT id, client_id, name, file_path, file_type, extracted_content, created_at
         FROM client_documents
        WHERE client_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 20`,
      [clientId]
    ).catch(() => []),
    query<ClientVisualReferenceRow>(
      `SELECT id, client_id, image_url, title, description, reference_type, is_primary, metadata
         FROM client_visual_references
        WHERE client_id = $1
        ORDER BY is_primary DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 20`,
      [clientId]
    ).catch(() => []),
    query<ClientContentLibraryRow>(
      `SELECT id, client_id, title, content, content_type, content_url,
              thumbnail_url, is_favorite, metadata, created_at
         FROM client_content_library
        WHERE client_id = $1
        ORDER BY is_favorite DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 50`,
      [clientId]
    ).catch(() => []),
    query<ClientReferenceLibraryRow>(
      `SELECT id, client_id, title, content, reference_type, source_url,
              thumbnail_url, metadata
         FROM client_reference_library
        WHERE client_id = $1
        ORDER BY created_at DESC NULLS LAST
        LIMIT 20`,
      [clientId]
    ).catch(() => []),
    query<ClientViralCompetitorRow>(
      `SELECT id, client_id, handle, platform, notes
         FROM client_viral_competitors
        WHERE client_id = $1
        ORDER BY added_at DESC`,
      [clientId]
    ).catch(() => []),
    query<ClientViralKeywordRow>(
      `SELECT id, client_id, keyword
         FROM client_viral_keywords
        WHERE client_id = $1
        ORDER BY created_at DESC`,
      [clientId]
    ).catch(() => []),
  ]);

  return decodeClientContext({
    client,
    prefs,
    websites,
    documents,
    visualReferences,
    contentLibrary,
    referenceLibrary,
    competitors,
    keywords,
  });
}

// ─── Prompt formatters ──────────────────────────────────────────────────

/**
 * Formats the client context into a system-prompt block that can be prefixed
 * onto LLM calls (Gemini, OpenAI, Anthropic). Pure string assembly — no I/O.
 *
 * Returns empty string when context is null or empty so callers can safely
 * concatenate without conditional logic.
 */
export function buildClientPromptContext(ctx: ClientContext | null): string {
  if (!ctx) return '';
  const c = ctx.client;
  const parts: string[] = [];

  parts.push('# CONTEXTO DO CLIENTE');
  parts.push(`Você está criando conteúdo pro cliente **${c.name}**.`);

  if (c.industry) parts.push(`- Indústria/segmento: ${c.industry}`);
  if (c.description) parts.push(`- Descrição: ${c.description}`);

  if (ctx.tone) parts.push(`- Voz/tom: ${ctx.tone}`);

  if (ctx.pillars.length > 0) {
    parts.push(`- Pilares de conteúdo: ${ctx.pillars.join(', ')}`);
  }

  const personaParts: string[] = [];
  if (ctx.persona.age) personaParts.push(`idade ${ctx.persona.age}`);
  if (ctx.persona.pain) personaParts.push(`dor: ${ctx.persona.pain}`);
  if (ctx.persona.goal) personaParts.push(`objetivo: ${ctx.persona.goal}`);
  if (personaParts.length > 0) {
    parts.push(`- Persona: ${personaParts.join(' · ')}`);
  }

  if (ctx.audience.length > 0) {
    parts.push(`- Público-alvo: ${ctx.audience.join(', ')}`);
  }

  if (ctx.brand.do.length > 0) {
    parts.push(`- Faça (brand voice DO): ${ctx.brand.do.join('; ')}`);
  }
  if (ctx.brand.dont.length > 0) {
    parts.push(`- EVITE (brand voice DON'T): ${ctx.brand.dont.join('; ')}`);
  }

  if (ctx.competitors.length > 0) {
    const list = ctx.competitors
      .slice(0, 8)
      .map((k) => `${k.handle}${k.platform ? ` (${k.platform})` : ''}`)
      .join(', ');
    parts.push(`- Concorrentes monitorados: ${list}`);
  }

  if (ctx.keywords.length > 0) {
    const list = ctx.keywords
      .slice(0, 12)
      .map((k) => k.keyword)
      .join(', ');
    parts.push(`- Keywords prioritárias: ${list}`);
  }

  if (c.identity_guide) {
    const trimmed = c.identity_guide.length > 4000
      ? c.identity_guide.slice(0, 4000) + '\n\n[...trecho truncado...]'
      : c.identity_guide;
    parts.push('\n## IDENTITY GUIDE COMPLETO\n' + trimmed);
  }

  return parts.join('\n');
}

/**
 * Synchronous fallback — sorts contentLibrary já carregada no ctx por
 * favorito + engagement metadata. Usado quando não há DB access ou similarity
 * search disponível.
 */
function scoreContentLibraryLocal(
  rows: ClientContentLibraryRow[],
  n: number
): ClientContentLibraryRow[] {
  return rows
    .map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const likes = Number(meta.likes) || 0;
      const comments = Number(meta.comments) || 0;
      const shares = Number(meta.shares) || 0;
      const views = Number(meta.views) || 0;
      const engagement = likes + 2 * comments + 5 * shares + views / 100;
      const favoriteBoost = row.is_favorite ? 1_000_000 : 0;
      return { row, score: favoriteBoost + engagement };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.row);
}

/**
 * Similarity search em client_content_library usando pgvector.
 * Retorna conteúdos do cliente mais próximos semanticamente do `queryText`.
 * Falha silenciosa: retorna [] se embedding não foi gerado ou OpenAI indisponível.
 */
export async function findSimilarContent(
  clientId: string,
  queryText: string,
  limit = 5
): Promise<
  Array<{
    id: string;
    title: string;
    content: string;
    similarity: number;
    engagement_score: number;
  }>
> {
  if (!clientId || !queryText?.trim()) return [];
  try {
    const embedding = await generateEmbedding(queryText);
    const vec = toVectorLiteral(embedding);

    const rows = await query<{
      id: string;
      title: string;
      content: string;
      similarity: number;
      engagement_score: number;
    }>(
      `SELECT id,
              title,
              content,
              COALESCE(engagement_score, 0)::float8 AS engagement_score,
              (1 - (embedding <=> $1::vector))::float8 AS similarity
         FROM public.client_content_library
        WHERE client_id = $2
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3`,
      [vec, clientId, limit],
    );
    return rows;
  } catch (err) {
    console.warn('[findSimilarContent] failed:', (err as Error).message);
    return [];
  }
}

/**
 * Top conteúdos do cliente ranqueados pela materialized view client_top_content
 * (engagement_score DESC, últimos 6 meses). Falha silenciosa se a view ainda
 * não foi criada (migration 0011 não aplicada).
 */
export async function getTopPerformingContent(
  clientId: string,
  limit = 5
): Promise<
  Array<{
    id: string;
    title: string;
    content: string;
    engagement_score: number;
    rank: number;
  }>
> {
  if (!clientId) return [];
  try {
    const rows = await query<{
      id: string;
      title: string;
      content: string;
      engagement_score: number;
      rank: number;
    }>(
      `SELECT id, title, content,
              COALESCE(engagement_score, 0)::float8 AS engagement_score,
              rank::int AS rank
         FROM public.client_top_content
        WHERE client_id = $1
          AND rank <= $2
        ORDER BY rank ASC`,
      [clientId, limit],
    );
    return rows;
  } catch (err) {
    console.warn(
      '[getTopPerformingContent] failed (view may not exist yet):',
      (err as Error).message,
    );
    return [];
  }
}

/**
 * Formats top-N entries from `contentLibrary` as a "winning examples" block.
 *
 * Estratégia (cascata):
 *   1. Se `query` provided → similarity search via pgvector (findSimilarContent)
 *   2. Senão (ou se #1 vazio) → top performing pela view (getTopPerformingContent)
 *   3. Fallback final → ordenação local por favorite + engagement metadata
 *
 * Async porque pode bater no DB. Mantém compatibilidade: callers antigos que
 * passavam só `(ctx, n)` continuam funcionando — `query` é opcional.
 */
export async function buildClientHistoricalReferences(
  ctx: ClientContext | null,
  queryOrN?: string | number,
  n = 3
): Promise<string> {
  if (!ctx) return '';

  // Compat: assinatura antiga (ctx, n=3) ou (ctx, query, n=3)
  let queryText: string | undefined;
  let limit = n;
  if (typeof queryOrN === 'number') {
    limit = queryOrN;
  } else if (typeof queryOrN === 'string') {
    queryText = queryOrN;
  }

  type RefItem = {
    title: string;
    content: string;
    content_type?: string;
    engagement_score?: number;
    similarity?: number;
  };

  let topContent: RefItem[] = [];

  // Etapa 1 — similarity search (precisa query + embeddings populados)
  if (queryText && ctx.client.id) {
    const similar = await findSimilarContent(ctx.client.id, queryText, limit);
    topContent = similar.map((c) => ({
      title: c.title,
      content: c.content,
      engagement_score: c.engagement_score,
      similarity: c.similarity,
    }));
  }

  // Etapa 2 — top performing via view
  if (topContent.length === 0 && ctx.client.id) {
    const top = await getTopPerformingContent(ctx.client.id, limit);
    topContent = top.map((c) => ({
      title: c.title,
      content: c.content,
      engagement_score: c.engagement_score,
    }));
  }

  // Etapa 3 — fallback local com contentLibrary já carregado
  if (topContent.length === 0 && ctx.contentLibrary.length > 0) {
    const local = scoreContentLibraryLocal(ctx.contentLibrary, limit);
    topContent = local.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const likes = Number(meta.likes) || 0;
      const comments = Number(meta.comments) || 0;
      const shares = Number(meta.shares) || 0;
      return {
        title: row.title,
        content: row.content,
        content_type: row.content_type,
        engagement_score: likes + 2 * comments + 5 * shares,
      };
    });
  }

  if (topContent.length === 0) return '';

  const parts: string[] = [];
  parts.push('## REFERÊNCIAS HISTÓRICAS DESTE CLIENTE');
  parts.push(
    'Estes conteúdos foram gravados como referência da voz/estilo. Use-os como inspiração de tom, estrutura e linguagem (não copie literalmente).',
  );
  topContent.forEach((row, i) => {
    const trimmed = row.content.length > 800 ? row.content.slice(0, 800) + '...' : row.content;
    const meta: string[] = [];
    if (row.content_type) meta.push(row.content_type);
    if (typeof row.engagement_score === 'number' && row.engagement_score > 0) {
      meta.push(`engagement ${row.engagement_score.toFixed(0)}`);
    }
    if (typeof row.similarity === 'number') {
      meta.push(`similarity ${(row.similarity * 100).toFixed(1)}%`);
    }
    const metaStr = meta.length ? ` (${meta.join(' · ')})` : '';
    parts.push(`\n### Exemplo ${i + 1} — ${row.title}${metaStr}\n${trimmed}`);
  });

  return parts.join('\n');
}
