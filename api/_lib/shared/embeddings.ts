// Helper para gerar embeddings via OpenAI (text-embedding-3-small, 1536 dims)
// Usa fetch nativo pra não adicionar dep `openai` ao bundle.
//
// NOTA: a coluna global_knowledge.embedding é vector(1536), por isso usamos
// text-embedding-3-small (default 1536). Se precisar usar outro modelo,
// migrar a coluna primeiro.

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS = 1536;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  return key;
}

/**
 * Gera embedding único pra um texto.
 * Trunca o input pra ~24k chars (≈8k tokens) por segurança — limite do modelo
 * é 8191 tokens, mas pra evitar erro deixamos folga.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  const safeInput = (text || '').slice(0, 24000);
  if (!safeInput.trim()) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const r = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: safeInput,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`OpenAI embeddings error ${r.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await r.json()) as OpenAIEmbeddingResponse;
  const emb = json.data?.[0]?.embedding;
  if (!Array.isArray(emb)) {
    throw new Error('OpenAI embeddings response missing embedding');
  }
  return emb;
}

/**
 * Gera embeddings em batch (até 2048 inputs por request — usar batches de 50
 * pra ficar conservador e dar tempo de update do DB entre chamadas).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const apiKey = getApiKey();
  const safeInputs = texts.map((t) => (t || '').slice(0, 24000));
  // OpenAI rejeita inputs vazios; substituir por placeholder se preciso.
  const cleaned = safeInputs.map((t) => (t.trim() ? t : '(empty)'));

  const r = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: cleaned,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`OpenAI embeddings batch error ${r.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await r.json()) as OpenAIEmbeddingResponse;
  if (!Array.isArray(json.data) || json.data.length !== texts.length) {
    throw new Error(
      `OpenAI embeddings batch returned ${json.data?.length ?? 0} entries, expected ${texts.length}`,
    );
  }
  // Reordena por `index` (a API garante mas vamos garantir aqui também).
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Formata um embedding como literal `vector` pra interpolar em SQL via $N::vector.
 *   const vec = toVectorLiteral([0.1, 0.2, ...]);
 *   await query('SELECT ... FROM ... ORDER BY embedding <=> $1::vector', [vec]);
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
