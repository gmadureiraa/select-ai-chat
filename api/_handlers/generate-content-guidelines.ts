// Migrated from supabase/functions/generate-content-guidelines/index.ts
import { anonPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { callLLM } from '../_lib/llm.js';

export default anonPost(async ({ body }) => {
  const { clientId } = body;
  if (!clientId) throw new Error('clientId is required');

  const pool = getPool();
  const [client, library, topPosts] = await Promise.all([
    queryOne<any>(`SELECT name, description, identity_guide, voice_profile, tags FROM clients WHERE id = $1`, [clientId]),
    pool.query(`SELECT title, content, content_type FROM client_content_library WHERE client_id = $1 AND is_favorite = true LIMIT 5`, [clientId]).then((r) => r.rows),
    pool.query(`SELECT caption, engagement_rate, post_type FROM instagram_posts WHERE client_id = $1 AND engagement_rate IS NOT NULL ORDER BY engagement_rate DESC LIMIT 5`, [clientId]).then((r) => r.rows),
  ]);
  if (!client) throw new Error('Client not found');

  let analysisContext = `Cliente: ${client.name}\n`;
  if (client.description) analysisContext += `Descrição: ${client.description}\n`;
  if (client.identity_guide) analysisContext += `\nGuia de Identidade (resumo):\n${String(client.identity_guide).substring(0, 2000)}\n`;
  const vp = client.voice_profile;
  if (vp) {
    if (vp.tone) analysisContext += `\nTom: ${vp.tone}`;
    if (vp.use?.length) analysisContext += `\nUsar: ${vp.use.join(', ')}`;
    if (vp.avoid?.length) analysisContext += `\nEvitar: ${vp.avoid.join(', ')}`;
  }
  if (library.length) {
    analysisContext += `\n\nExemplos favoritos da biblioteca:\n`;
    for (const item of library) {
      analysisContext += `- [${item.content_type}] "${item.title}": ${(item.content || '').substring(0, 300)}\n`;
    }
  }
  if (topPosts.length) {
    analysisContext += `\n\nTop posts por engagement:\n`;
    for (const p of topPosts) {
      const rate = ((p.engagement_rate || 0) * 100).toFixed(1);
      analysisContext += `- [${p.post_type}] ${rate}% eng: "${(p.caption || '').substring(0, 200)}"\n`;
    }
  }

  const result = await callLLM(
    [
      {
        role: 'system',
        content: `Você é um estrategista de conteúdo. Analise os dados do cliente e gere um GUIA DE CRIAÇÃO DE CONTEÚDO prático e direto.

O guia deve ter regras curtas e acionáveis em formato de bullet points (•). Categorize em seções:
1. Estrutura (como organizar o conteúdo)
2. Linguagem (tom, expressões, estilo)
3. Ganchos (como abrir posts/conteúdos)
4. CTAs (como fechar/converter)
5. O que NUNCA fazer

Cada regra deve ser específica para ESTE cliente baseado nos dados. Evite conselhos genéricos.
Máximo 15-20 regras no total. Retorne APENAS o guia, sem explicações.`,
      },
      { role: 'user', content: `Gere o guia de criação para este cliente:\n\n${analysisContext}` },
    ],
    { maxTokens: 2048, temperature: 0.6 }
  );

  return { guidelines: result.content };
});
