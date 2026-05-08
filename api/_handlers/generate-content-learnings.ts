// Migrated from supabase/functions/generate-content-learnings/index.ts
import { authedPost } from '../_lib/handler.js';
import { logAIUsage, estimateTokens } from '../_lib/shared/ai-usage.js';

const MODEL = 'gemini-2.0-flash';

export default authedPost(async ({ user, body }) => {
  const { clientId, topPostsContext, bottomPostsContext, typeAvgContext, totalPosts } = body;
  if (!topPostsContext) throw new Error('Context is required');

  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured');

  const prompt = `Você é um analista de conteúdo de redes sociais. Analise os dados de performance dos posts e extraia APRENDIZADOS PRÁTICOS sobre o que funciona melhor.

═══════════════════════════════════════════════════════════════
DADOS ANALISADOS (${totalPosts} posts)
═══════════════════════════════════════════════════════════════

## TOP 5 POSTS (maior engajamento)
${topPostsContext}

## POSTS COM MENOR PERFORMANCE
${bottomPostsContext}

## MÉDIA POR FORMATO
${typeAvgContext}

═══════════════════════════════════════════════════════════════
FORMATO DA RESPOSTA
═══════════════════════════════════════════════════════════════

Gere aprendizados estruturados em Markdown:

## O Que Está Funcionando
- [Padrão identificado nos top posts]
- [Formato ou estilo que gera mais engajamento]
- [Elemento comum]

## O Que Evitar
- [Padrão dos posts de baixa performance]
- [Elemento que não engaja]

## Recomendações Baseadas nos Dados
1. **[Ação específica]:** [Baseada nos top posts]
2. **[Formato ideal]:** [Baseado nas médias por tipo]

## Insight Principal
[Frase resumindo o aprendizado mais importante]

REGRAS:
- Baseie-se APENAS nos dados fornecidos
- Seja específico sobre ganchos, CTAs, temas
- Cite métricas quando relevante
- Máximo 180 palavras`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini API error: ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const learnings = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar aprendizados.';
  const inputTokens = data?.usageMetadata?.promptTokenCount || estimateTokens(prompt);
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || estimateTokens(learnings);

  await logAIUsage(user.id, MODEL, 'generate-content-learnings', inputTokens, outputTokens, { client_id: clientId });
  return { learnings };
});
