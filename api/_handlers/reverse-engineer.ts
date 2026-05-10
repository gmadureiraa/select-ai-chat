// Migrated from supabase/functions/reverse-engineer/index.ts
// Two phases:
//   phase=analyze  -> Gemini 2.0 Flash Exp inspects images/text and returns
//                     structured JSON describing the reference content.
//   phase=generate -> Gemini 2.5 Flash recreates the content adapted to the
//                     client's voice/audience using the analysis as scaffold.
import { authedPost } from '../_lib/handler.js';
import { queryOne, query } from '../_lib/db.js';
import { logAIUsage } from '../_lib/shared/ai-usage.js';
import { assertClientAccess } from '../_lib/access.js';

interface ReverseBody {
  clientId: string;
  phase: 'analyze' | 'generate';
  referenceImages?: string[];
  referenceText?: string;
  instagramCaption?: string;
  analysis?: any;
  userId?: string;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    return { data: buf.toString('base64'), mime };
  } catch (e) {
    console.warn('[reverse-engineer] fetchImageAsBase64 failed:', url, e);
    return null;
  }
}

function parseDataUrl(input: string): { mime: string; data: string } | null {
  const m = input.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], data: m[2] };
}

export default authedPost(async ({ user, body }) => {
  const {
    clientId,
    phase,
    referenceImages,
    referenceText,
    instagramCaption,
    analysis,
    userId: bodyUserId,
  } = body as ReverseBody;

  if (!clientId) throw new Error('clientId é obrigatório');
  if (!phase || (phase !== 'analyze' && phase !== 'generate')) {
    throw new Error('phase deve ser "analyze" ou "generate"');
  }
  await assertClientAccess(user.id, clientId);

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY não configurada');

  const userId = bodyUserId || user.id;

  // Lookup client
  const client = await queryOne<any>(
    `SELECT id, name, context_notes, tags, social_media FROM clients WHERE id = $1`,
    [clientId]
  );
  if (!client) throw new Error('Cliente não encontrado');

  // Lookup templates
  const templates = await query<any>(
    `SELECT name, rules FROM client_templates WHERE client_id = $1`,
    [clientId]
  );

  // ============================================================
  // PHASE 1 — ANALYZE
  // ============================================================
  if (phase === 'analyze') {
    console.log('[reverse-engineer] phase 1: analyze');
    const parts: any[] = [];

    if (referenceImages && referenceImages.length > 0) {
      let textPrompt = `Analise este conteúdo visual em detalhes. Cada imagem representa uma página/slide do conteúdo.

Forneça uma análise estruturada em JSON com os seguintes campos:
- content_type: tipo do conteúdo (carrossel, reels, post_unico, video_longo, blog, newsletter, outro)
- page_count: número de páginas/slides/frames
- hook: gancho inicial que prende atenção
- structure: array com {page, purpose, content_summary} para cada página
- tone: tom de voz identificado
- cta: call-to-action final
- engagement_tactics: array de táticas de engajamento identificadas
- visual_elements: array de elementos visuais importantes (cores, fontes, layout)`;

      if (instagramCaption) {
        textPrompt += `\n\nLEGENDA ORIGINAL DO POST:\n${instagramCaption}\n\nAnalise esta legenda em conjunto com as imagens.`;
      }

      parts.push({ text: textPrompt });

      for (const imageUrl of referenceImages) {
        const dataUrl = parseDataUrl(imageUrl);
        if (dataUrl) {
          parts.push({ inlineData: { mimeType: dataUrl.mime, data: dataUrl.data } });
        } else {
          const fetched = await fetchImageAsBase64(imageUrl);
          if (fetched) {
            parts.push({ inlineData: { mimeType: fetched.mime, data: fetched.data } });
          }
        }
      }
    } else if (referenceText) {
      parts.push({
        text: `Analise este conteúdo em detalhes:\n\n${referenceText}\n\nForneça uma análise estruturada em JSON com os campos: content_type, page_count, hook, structure (array), tone, cta, engagement_tactics (array), visual_elements (array).`,
      });
    } else {
      throw new Error('Nenhum conteúdo de referência fornecido');
    }

    const analysisResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          systemInstruction: {
            parts: [{
              text:
                'Você é um especialista em engenharia reversa de conteúdo digital. Sempre retorne análises em formato JSON válido.',
            }],
          },
          generationConfig: { temperature: 1.0, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text().catch(() => '');
      console.error('[reverse-engineer] analysis error:', errorText);
      throw new Error(`Google API error: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const content = analysisData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Nenhuma análise foi retornada');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta não está em formato JSON válido');
    const structuredAnalysis = JSON.parse(jsonMatch[0]);

    if (userId && analysisData.usageMetadata) {
      await logAIUsage(
        userId,
        'gemini-2.0-flash-exp',
        'reverse-engineer-analyze',
        analysisData.usageMetadata.promptTokenCount || 0,
        analysisData.usageMetadata.candidatesTokenCount || 0,
        { client_id: clientId, phase: 'analyze' }
      );
    }

    return structuredAnalysis;
  }

  // ============================================================
  // PHASE 2 — GENERATE
  // ============================================================
  if (!analysis) throw new Error('analysis é obrigatório na fase generate');

  console.log('[reverse-engineer] phase 2: generate');

  const tags = client.tags ?? {};
  const socialMedia = client.social_media ?? {};

  const clientContext = `
## PERFIL COMPLETO DO CLIENTE: ${client.name}

### Contexto Base
${client.context_notes || ''}

### Tags Estratégicas
${tags ? `
- Segmento: ${tags.segment || ''}
- Tom de Voz: ${tags.tone || ''}
- Objetivos: ${tags.objectives || ''}
- Público-Alvo: ${tags.audience || ''}
` : ''}

### Templates e Padrões
${
    templates && templates.length > 0
      ? templates
          .map(
            (t: any) =>
              `- ${t.name}: ${JSON.stringify(t.rules || {}).substring(0, 500)}`
          )
          .join('\n')
      : 'Nenhum template específico'
  }

### Redes Sociais
${
    socialMedia
      ? Object.entries(socialMedia)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n')
      : ''
  }
`.trim();

  const generationPrompt = `## ANÁLISE ESTRUTURADA DO CONTEÚDO ORIGINAL

**Tipo:** ${analysis.content_type}
**Número de Páginas:** ${analysis.page_count}
**Hook Inicial:** ${analysis.hook}
**Tom:** ${analysis.tone}
**CTA:** ${analysis.cta}

**Estrutura:**
${(analysis.structure || [])
  .map((s: any) => `- Página ${s.page}: ${s.purpose} - ${s.content_summary}`)
  .join('\n')}

**Táticas de Engajamento:**
${(analysis.engagement_tactics || []).map((t: string) => `- ${t}`).join('\n')}

**Elementos Visuais:**
${(analysis.visual_elements || []).map((e: string) => `- ${e}`).join('\n') || 'Não especificados'}

---

${clientContext}

---

## TAREFA: RECRIAÇÃO ADAPTADA

Recrie o conteúdo MANTENDO:
- A estrutura de ${analysis.page_count} páginas/slides
- O tipo de hook identificado
- As táticas de engajamento

MAS ADAPTANDO:
- Tom de voz para ${tags?.tone || analysis.tone}
- Linguagem para o público ${tags?.audience || 'do cliente'}
- CTA alinhado aos objetivos: ${tags?.objectives || 'do cliente'}
- Seguindo os padrões dos templates

**FORMATO DE SAÍDA OBRIGATÓRIO:**
${
    analysis.page_count > 1
      ? `
Use headers Markdown para cada página:

## 📄 Página 1
[conteúdo da primeira página]

## 📄 Página 2
[conteúdo da segunda página]

E assim por diante para todas as ${analysis.page_count} páginas.
`
      : 'Entregue o conteúdo completo adaptado.'
  }`;

  const generationResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: generationPrompt }] }],
        systemInstruction: {
          parts: [{
            text:
              'Você é um criador de conteúdo especializado que adapta referências ao estilo único de cada cliente.',
          }],
        },
        generationConfig: { temperature: 1.0, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!generationResponse.ok) {
    const errorText = await generationResponse.text().catch(() => '');
    console.error('[reverse-engineer] generation error:', errorText);
    throw new Error(`Google API error: ${generationResponse.status}`);
  }

  const generationData = await generationResponse.json();
  const content = generationData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Nenhum conteúdo foi gerado');

  if (userId && generationData.usageMetadata) {
    await logAIUsage(
      userId,
      'gemini-2.5-flash',
      'reverse-engineer-generate',
      generationData.usageMetadata.promptTokenCount || 0,
      generationData.usageMetadata.candidatesTokenCount || 0,
      { client_id: clientId, phase: 'generate' }
    );
  }

  return { content };
});
