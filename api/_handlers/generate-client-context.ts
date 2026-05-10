// Migrated from supabase/functions/generate-client-context/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const LIMITS = {
  websiteChars: 3000,
  documentChars: 2000,
  contentChars: 1500,
  referenceChars: 1000,
  instagramChars: 500,
  youtubeChars: 2000,
  totalPromptChars: 60000,
};

function truncate(text: string | null | undefined, limit: number): string {
  if (!text) return '';
  return text.length > limit ? text.substring(0, limit) + '...' : text;
}

export default authedPost(async ({ body, user }) => {
  const { clientId } = body;
  if (!clientId) throw new Error('clientId é obrigatório');
  await assertClientAccess(user.id, clientId);
  console.log(`[generate-client-context] Starting for client ${clientId}`);

  const pool = getPool();
  const [clientRow, websites, documents, content, references, instagram, youtube] = await Promise.all([
    queryOne<any>(`SELECT name, description, tags, social_media FROM clients WHERE id = $1`, [clientId]),
    pool.query(`SELECT url, scraped_markdown FROM client_websites WHERE client_id = $1`, [clientId]).then((r) => r.rows),
    pool.query(`SELECT name, extracted_content FROM client_documents WHERE client_id = $1`, [clientId]).then((r) => r.rows),
    pool.query(`SELECT title, content, content_type FROM client_content_library WHERE client_id = $1 AND is_favorite = true LIMIT 10`, [clientId]).then((r) => r.rows),
    pool.query(`SELECT title, content FROM client_reference_library WHERE client_id = $1 LIMIT 10`, [clientId]).then((r) => r.rows),
    pool.query(`SELECT caption, engagement_rate FROM instagram_posts WHERE client_id = $1 ORDER BY engagement_rate DESC NULLS LAST LIMIT 5`, [clientId]).then((r) => r.rows),
    pool.query(`SELECT title, transcript, total_views FROM youtube_videos WHERE client_id = $1 AND transcript IS NOT NULL ORDER BY total_views DESC NULLS LAST LIMIT 5`, [clientId]).then((r) => r.rows),
  ]);

  if (!clientRow) throw new Error('Cliente não encontrado');

  const sources = {
    profile: {
      name: clientRow.name,
      description: clientRow.description,
      tags: clientRow.tags || {},
      social_media: clientRow.social_media || {},
    },
    websites: websites.filter((w: any) => w.scraped_markdown).map((w: any) => ({ url: w.url, content: truncate(w.scraped_markdown, LIMITS.websiteChars) })),
    documents: documents.filter((d: any) => d.extracted_content).map((d: any) => ({ name: d.name, content: truncate(d.extracted_content, LIMITS.documentChars) })),
    contentLibrary: content.map((c: any) => ({ title: c.title, content: truncate(c.content, LIMITS.contentChars), type: c.content_type })),
    referenceLibrary: references.map((r: any) => ({ title: r.title, content: truncate(r.content, LIMITS.referenceChars) })),
    instagramPosts: instagram.map((p: any) => ({ caption: truncate(p.caption, LIMITS.instagramChars), engagement: p.engagement_rate || 0 })),
    youtubeVideos: youtube.map((v: any) => ({ title: v.title, transcript: truncate(v.transcript, LIMITS.youtubeChars), views: v.total_views || 0 })),
  };

  let dataSection = `# DADOS DO CLIENTE: ${sources.profile.name}

## INFORMAÇÕES BÁSICAS
- **Nome:** ${sources.profile.name}
- **Descrição:** ${sources.profile.description || 'Não informada'}
- **Segmento:** ${sources.profile.tags.segment || 'Não informado'}
- **Tom de Voz:** ${sources.profile.tags.tone || 'Não informado'}
- **Público-Alvo:** ${sources.profile.tags.audience || 'Não informado'}
- **Objetivos:** ${sources.profile.tags.objectives || 'Não informados'}

## REDES SOCIAIS
${Object.entries(sources.profile.social_media).filter(([_, v]) => v).map(([k, v]) => `- **${k}:** ${v}`).join('\n') || 'Nenhuma rede social cadastrada'}
`;

  if (sources.websites.length > 0) {
    dataSection += `\n## WEBSITES ANALISADOS (${sources.websites.length})\n`;
    sources.websites.forEach((w, i) => { dataSection += `\n### Website ${i + 1}: ${w.url}\n${w.content}\n`; });
  }
  if (sources.documents.length > 0) {
    dataSection += `\n## DOCUMENTOS TRANSCRITOS (${sources.documents.length})\n`;
    sources.documents.forEach((d) => { dataSection += `\n### ${d.name}\n${d.content}\n`; });
  }
  if (sources.contentLibrary.length > 0) {
    dataSection += `\n## CONTEÚDOS FAVORITOS DA BIBLIOTECA (${sources.contentLibrary.length})\n`;
    sources.contentLibrary.forEach((c) => { dataSection += `\n### ${c.title} (${c.type})\n${c.content}\n`; });
  }
  if (sources.referenceLibrary.length > 0) {
    dataSection += `\n## REFERÊNCIAS EXTERNAS (${sources.referenceLibrary.length})\n`;
    sources.referenceLibrary.forEach((r) => { dataSection += `\n### ${r.title}\n${r.content}\n`; });
  }
  if (sources.instagramPosts.length > 0) {
    dataSection += `\n## TOP POSTS DO INSTAGRAM (${sources.instagramPosts.length})\n`;
    sources.instagramPosts.forEach((p, i) => { dataSection += `\n### Post ${i + 1} (${(Number(p.engagement) * 100).toFixed(1)}% engagement)\n${p.caption}\n`; });
  }
  if (sources.youtubeVideos.length > 0) {
    dataSection += `\n## TOP VÍDEOS DO YOUTUBE (${sources.youtubeVideos.length})\n`;
    sources.youtubeVideos.forEach((v) => { dataSection += `\n### ${v.title} (${Number(v.views).toLocaleString()} views)\n**Transcrição:**\n${v.transcript}\n`; });
  }
  if (dataSection.length > LIMITS.totalPromptChars) {
    dataSection = dataSection.substring(0, LIMITS.totalPromptChars) + '\n\n[... conteúdo truncado por limite de tamanho ...]';
  }

  const systemPrompt = `Você é um especialista em estratégia de marca e marketing digital.

Analise TODAS as informações fornecidas sobre o cliente e gere um documento de contexto COMPLETO e ESTRUTURADO em Markdown.

Este documento será usado pela IA para criar TODO o conteúdo do cliente, então seja:
- **ESPECÍFICO:** Use exemplos reais do material fornecido
- **PRÁTICO:** Foque em diretrizes acionáveis para criação de conteúdo
- **FIEL:** Preserve o tom de voz identificado nos materiais
- **COMPLETO:** Cubra todas as seções do template

IMPORTANTE:
- NÃO invente informações que não estão nos dados
- Se alguma seção não tem dados suficientes, indique "[Dados insuficientes - adicione mais material]"
- Extraia padrões de linguagem, estrutura e estilo dos conteúdos existentes
- Identifique palavras-chave e expressões recorrentes`;

  const userPrompt = `${dataSection}

---

Com base em TODOS os dados acima, gere o documento de contexto seguindo um template estruturado em Markdown. Seja específico e use exemplos reais dos materiais.`;

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('Chave da API do Google AI não configurada');

  console.log(`[generate-client-context] Calling Gemini with ${dataSection.length} chars of context`);
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido. Vou gerar o documento de contexto.' }] },
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  });
  if (!r.ok) {
    const errorText = await r.text();
    console.error('Gemini API error:', errorText);
    throw new Error('Erro ao gerar contexto com IA');
  }
  const data = await r.json();
  const generatedContext: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log(`[generate-client-context] Generated ${generatedContext.length} chars of context`);

  await pool.query(
    `UPDATE clients SET identity_guide = $1, updated_at = NOW() WHERE id = $2`,
    [generatedContext, clientId]
  );

  return {
    success: true,
    context: generatedContext,
    sources: {
      hasDescription: !!sources.profile.description,
      hasTags: Object.values(sources.profile.tags).some((v) => v),
      websitesCount: sources.websites.length,
      documentsCount: sources.documents.length,
      contentCount: sources.contentLibrary.length,
      referencesCount: sources.referenceLibrary.length,
      instagramCount: sources.instagramPosts.length,
      youtubeCount: sources.youtubeVideos.length,
    },
  };
});
