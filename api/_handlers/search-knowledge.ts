// search-knowledge: pesquisa híbrida em global_knowledge.
//
// Estratégia:
//   1. Gera embedding do query via OpenAI text-embedding-3-small (1536 dims).
//   2. Faz cosine similarity via RPC public.search_knowledge_semantic
//      (filtra por workspace_id, threshold 0.4).
//   3. ILIKE fallback: roda em paralelo pra cobrir itens sem embedding ou
//      casos onde a OpenAI/embedding falha.
//   4. Mescla resultados, semantic vence em caso de duplicata.
//
// Migrated from supabase/functions/search-knowledge/index.ts
import { authedPost } from '../_lib/handler.js';
import { query, queryOne } from '../_lib/db.js';
import { generateEmbedding, toVectorLiteral } from '../_lib/shared/embeddings.js';

interface KnowledgeResult {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  category?: string | null;
  source_url?: string | null;
  similarity?: number | null;
  searchType: 'semantic' | 'text';
}

export default authedPost(async ({ user, body }) => {
  const { query: q, workspaceId, limit = 5, threshold = 0.4 } = body;
  if (!q || !workspaceId) throw new Error('query and workspaceId are required');

  // Verify membership
  const member = await queryOne<{ id: string }>(
    `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [workspaceId, user.id],
  );
  if (!member) {
    return { error: 'Access denied - not a workspace member', success: false };
  }

  const matchCount = Math.min(Math.max(Number(limit) || 5, 1), 50);
  const matchThreshold = Math.min(Math.max(Number(threshold) || 0.4, 0), 1);

  // 1. Gerar embedding do query
  let queryEmbedding: number[] | null = null;
  let embedError: string | null = null;
  try {
    queryEmbedding = await generateEmbedding(String(q));
  } catch (e: any) {
    embedError = e?.message || 'embedding failed';
    console.warn('[search-knowledge] embedding failed:', embedError);
  }

  // 2. Pesquisa semantica (se temos embedding)
  let semanticResults: KnowledgeResult[] = [];
  if (queryEmbedding) {
    try {
      const rows = await query<any>(
        `SELECT id, title, content, summary, category, source_url, similarity
           FROM public.search_knowledge_semantic($1::vector, $2::uuid, $3::int, $4::float)`,
        [toVectorLiteral(queryEmbedding), workspaceId, matchCount, matchThreshold],
      );
      semanticResults = rows.map((r) => ({ ...r, searchType: 'semantic' as const }));
    } catch (e: any) {
      console.warn('[search-knowledge] semantic search failed:', e?.message);
    }
  }

  // 3. ILIKE fallback (sempre roda — cobre itens sem embedding e queries curtas)
  let textResults: KnowledgeResult[] = [];
  try {
    const rows = await query<any>(
      `SELECT id, title, content, summary, category::text AS category, source_url
         FROM public.global_knowledge
        WHERE workspace_id = $1
          AND (title ILIKE $2 OR content ILIKE $2)
        ORDER BY updated_at DESC
        LIMIT $3`,
      [workspaceId, `%${q}%`, matchCount],
    );
    textResults = rows.map((r) => ({ ...r, similarity: null, searchType: 'text' as const }));
  } catch (e: any) {
    console.warn('[search-knowledge] text search failed:', e?.message);
  }

  // 4. Mescla — semantic primeiro (mais confiável)
  const resultMap = new Map<string, KnowledgeResult>();
  for (const r of semanticResults) resultMap.set(r.id, r);
  for (const r of textResults) {
    if (!resultMap.has(r.id)) resultMap.set(r.id, r);
  }

  return {
    success: true,
    results: Array.from(resultMap.values()),
    semanticCount: semanticResults.length,
    textCount: textResults.length,
    embedError, // null se OK; string se falhou (frontend pode mostrar warning)
  };
});
