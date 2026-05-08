// Migrated from supabase/functions/process-knowledge/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

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

async function generateSummary(content: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em sumarização de conteúdo. Analise e extraia:
1. Resumo conciso (máximo 3 parágrafos)
2. 3-7 key takeaways

Responda APENAS em JSON: {"summary":"...","keyTakeaways":["..."]}`,
        },
        { role: 'user', content: `Analise e resuma este conteúdo:\n\n${content.substring(0, 15000)}` },
      ],
      temperature: 0.3,
    }),
  });
  if (!r.ok) throw new Error(`AI request failed: ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      return { summary: parsed.summary || '', keyTakeaways: parsed.keyTakeaways || [] };
    }
  } catch {}
  return { summary: text.substring(0, 1000), keyTakeaways: [] };
}

async function generateEmbedding(text: string): Promise<number[]> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
  const r = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.substring(0, 8000), dimensions: 768 }),
  });
  if (!r.ok) throw new Error(`Embedding request failed: ${r.status}`);
  const data = await r.json();
  return data.data?.[0]?.embedding || [];
}

export default authedPost(async ({ body }) => {
  const { type, url, content, knowledgeId } = body;

  let result: any = {};
  if (type === 'url' && url) {
    const scraped = await scrapeUrl(url);
    const { summary, keyTakeaways } = await generateSummary(scraped.content);
    const embedding = await generateEmbedding(scraped.content);
    result = { title: scraped.title, content: scraped.content, description: scraped.description, summary, keyTakeaways, embedding, sourceUrl: url };
  } else if (type === 'summarize' && content) {
    const { summary, keyTakeaways } = await generateSummary(content);
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
    if (result.embedding !== undefined) { fields.push(`embedding = $${i++}::vector`); values.push(`[${result.embedding.join(',')}]`); }
    if (result.sourceUrl !== undefined) { fields.push(`source_url = $${i++}`); values.push(result.sourceUrl); }
    if (fields.length > 0) {
      values.push(knowledgeId);
      try {
        await getPool().query(`UPDATE global_knowledge SET ${fields.join(', ')} WHERE id = $${i}`, values);
      } catch (e) {
        console.warn('[process-knowledge] update failed:', e);
      }
    }
  }
  return { success: true, data: result };
});
