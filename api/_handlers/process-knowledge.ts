// Migrated from supabase/functions/process-knowledge/index.ts
//
// Fixes pós-migração Neon (2026-05-16):
//   1. Embedding agora é OpenAI text-embedding-3-small (1536 dims) pra bater
//      com a coluna vector(1536) da tabela global_knowledge — antes era
//      Lovable Gateway com 768 dims, que falhava ou corrompia o vector store.
//   2. Summary migrou de Lovable Gateway pra `callLLM` (Gemini primário,
//      OpenAI fallback). LOVABLE_API_KEY foi descontinuado pós-Neon.
//   3. `knowledgeId` agora exige que o user autenticado seja membro do
//      workspace dono daquela row, fechando o cross-tenant write.
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { callLLM } from '../_lib/llm.js';
import { assertWorkspaceAccess } from '../_lib/access.js';
import { generateEmbedding, toVectorLiteral } from '../_lib/shared/embeddings.js';

async function scrapeUrl(url: string) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
  });
  if (!r.ok) throw new Error(`Failed to fetch URL: ${r.statusText}`);
  const html = await r.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1] : '';
  let textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  textContent = textContent.substring(0, 30000);
  return { title, content: textContent, description };
}

async function generateSummary(content: string, userId: string) {
  const result = await callLLM(
    [
      {
        role: 'system',
        content: `Você é um especialista em sumarização de conteúdo. Analise e extraia:
1. Resumo conciso (máximo 3 parágrafos)
2. 3-7 key takeaways

Responda APENAS em JSON: {"summary":"...","keyTakeaways":["..."]}`,
      },
      { role: 'user', content: `Analise e resuma este conteúdo:\n\n${content.substring(0, 15000)}` },
    ],
    {
      temperature: 0.3,
      maxTokens: 2048,
      usageContext: { userId, edgeFunction: 'process-knowledge' },
    },
  );
  const text = result.content || '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return { summary: parsed.summary || '', keyTakeaways: parsed.keyTakeaways || [] };
    }
  } catch {}
  return { summary: text.substring(0, 1000), keyTakeaways: [] };
}

export default authedPost(async ({ body, user }) => {
  const { type, url, content, knowledgeId } = body;

  // Se o caller pediu pra persistir num knowledge row, validar ownership ANTES
  // de gastar Gemini/embeddings.
  if (knowledgeId) {
    const ownerRow = await queryOne<{ workspace_id: string }>(
      'SELECT workspace_id FROM public.global_knowledge WHERE id = $1 LIMIT 1',
      [knowledgeId],
    );
    if (!ownerRow) throw new Error('Knowledge entry não encontrada');
    await assertWorkspaceAccess(user.id, ownerRow.workspace_id);
  }

  let result: any = {};
  if (type === 'url' && url) {
    const scraped = await scrapeUrl(url);
    const { summary, keyTakeaways } = await generateSummary(scraped.content, user.id);
    const embedding = await generateEmbedding(scraped.content);
    result = { title: scraped.title, content: scraped.content, description: scraped.description, summary, keyTakeaways, embedding, sourceUrl: url };
  } else if (type === 'summarize' && content) {
    const { summary, keyTakeaways } = await generateSummary(content, user.id);
    result = { summary, keyTakeaways };
  } else if (type === 'embed' && content) {
    const embedding = await generateEmbedding(content);
    result = { embedding };
  } else {
    throw new Error('Invalid request: missing type or required data');
  }

  if (knowledgeId) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (result.summary !== undefined) { fields.push(`summary = $${i++}`); values.push(result.summary); }
    if (result.keyTakeaways !== undefined) { fields.push(`key_takeaways = $${i++}::jsonb`); values.push(JSON.stringify(result.keyTakeaways)); }
    if (Array.isArray(result.embedding)) {
      if (result.embedding.length !== 1536) {
        throw new Error(`Embedding dim mismatch: got ${result.embedding.length}, expected 1536`);
      }
      fields.push(`embedding = $${i++}::vector`);
      values.push(toVectorLiteral(result.embedding));
    }
    if (result.sourceUrl !== undefined) { fields.push(`source_url = $${i++}`); values.push(result.sourceUrl); }
    if (fields.length > 0) {
      values.push(knowledgeId);
      try {
        await getPool().query(`UPDATE public.global_knowledge SET ${fields.join(', ')} WHERE id = $${i}`, values);
      } catch (e) {
        console.warn('[process-knowledge] update failed:', e);
      }
    }
  }
  return { success: true, data: result };
});
