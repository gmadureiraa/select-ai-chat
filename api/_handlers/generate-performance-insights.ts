// Migrated from supabase/functions/generate-performance-insights/index.ts
// NOTE: workspace token check deferred — implement when Neon schema for workspace tokens is ported
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

const MODEL = 'gemini-2.0-flash';

export default authedPost(async ({ user, body }) => {
  const { clientId, clientName, context, userId, periodLabel, platform, startDate, endDate } = body;
  if (!context) throw new Error('Context is required');
  if (clientId) await assertClientAccess(user.id, clientId);
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_STUDIO_API_KEY not configured');

  const platformName = platform === 'youtube' ? 'YouTube' : 'Instagram';
  const periodInfo = periodLabel || (startDate && endDate ? `${startDate} a ${endDate}` : 'período selecionado');

  const totalPosts = context.instagram?.totalPosts || 0;
  const avgLikes = totalPosts > 0 ? Math.round((context.instagram?.totalLikes || 0) / totalPosts) : 0;
  const avgComments = totalPosts > 0 ? Math.round((context.instagram?.totalComments || 0) / totalPosts) : 0;
  const avgShares = totalPosts > 0 ? Math.round((context.instagram?.totalShares || 0) / totalPosts) : 0;
  const avgSaves = totalPosts > 0 ? Math.round((context.instagram?.totalSaves || 0) / totalPosts) : 0;

  const contextSummary = platform === 'youtube'
    ? `═══════════════════════════════════════════════════════════════
DADOS DE PERFORMANCE - YOUTUBE
Cliente: ${clientName}
Período: ${periodInfo}
═══════════════════════════════════════════════════════════════

## MÉTRICAS MACRO
- Views totais: ${context.youtube?.totalViews?.toLocaleString() || 0}
- Horas assistidas: ${context.youtube?.watchHours?.toLocaleString() || 0}h
- Subscribers ganhos: ${context.youtube?.subscribers?.toLocaleString() || 0}

${context.youtube?.topVideos?.length ? `## TOP VÍDEOS
${context.youtube.topVideos.slice(0, 5).map((v: any, i: number) => `${i + 1}. "${v.title?.slice(0, 60) || 'Sem título'}..."\n   • Views: ${v.views?.toLocaleString() || 0} | CTR: ${v.ctr?.toFixed(2) || 0}%`).join('\n\n')}` : ''}`
    : `═══════════════════════════════════════════════════════════════
DADOS DE PERFORMANCE - INSTAGRAM
Cliente: ${clientName}
Período: ${periodInfo}
═══════════════════════════════════════════════════════════════

## MÉTRICAS MACRO
- Total de posts: ${totalPosts}
- Curtidas: ${context.instagram?.totalLikes?.toLocaleString() || 0}
- Comentários: ${context.instagram?.totalComments?.toLocaleString() || 0}
- Salvamentos: ${context.instagram?.totalSaves?.toLocaleString() || 0}
- Compartilhamentos: ${context.instagram?.totalShares?.toLocaleString() || 0}
- Alcance total: ${context.instagram?.totalReach?.toLocaleString() || 0}
- Engajamento médio: ${context.instagram?.avgEngagement?.toFixed(2) || 0}%

## MÉDIAS POR POST
- Curtidas/post: ${avgLikes}
- Comentários/post: ${avgComments}
- Compartilhamentos/post: ${avgShares}
- Salvamentos/post: ${avgSaves}

${context.instagram?.topPosts?.length ? `## TOP POSTS (por engajamento)
${context.instagram.topPosts.slice(0, 5).map((p: any, i: number) => `${i + 1}. [${p.type || 'post'}] "${p.caption?.slice(0, 60) || 'Sem legenda'}..."\n   • Curtidas: ${p.likes} | Comentários: ${p.comments || 0} | Salvamentos: ${p.saves || 0} | Compartilhamentos: ${p.shares || 0}\n   • Engajamento: ${p.engagement?.toFixed(2) || 0}%`).join('\n\n')}` : ''}`;

  const prompt = `Você é um analista sênior de marketing digital. Analise os dados de ${platformName} e gere insights ESTRATÉGICOS e ACIONÁVEIS.

${contextSummary}

═══════════════════════════════════════════════════════════════
FORMATO DA RESPOSTA
═══════════════════════════════════════════════════════════════

Gere uma análise estruturada em Markdown com:

## Visão Geral
[1-2 frases resumindo o desempenho geral do período, citando números específicos]

## Destaques do Período
- [Destaque 1]
- [Destaque 2]
- [Destaque 3]

## Oportunidades de Melhoria
- [Oportunidade 1]
- [Oportunidade 2]

## Recomendações Estratégicas
1. **[Ação imediata]:** [...]
2. **[Ação de médio prazo]:** [...]

REGRAS:
- Use APENAS dados fornecidos, nunca invente
- Cite números específicos e porcentagens
- Seja direto e prático
- Máximo 200 palavras total`;

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
  if (!r.ok) {
    const t = await r.text();
    console.error('[generate-performance-insights] Gemini API error:', t);
    throw new Error(`Gemini API error: ${r.status}`);
  }
  const data = await r.json();
  const insights: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar insights.';
  const inputTokens = data?.usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);
  const outputTokens = data?.usageMetadata?.candidatesTokenCount || Math.ceil(insights.length / 4);

  const resolvedUserId = userId || user.id;
  if (resolvedUserId) {
    try {
      await getPool().query(
        `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [resolvedUserId, MODEL, 'generate-performance-insights', inputTokens, outputTokens, JSON.stringify({ clientId, clientName })]
      );
    } catch (e) {
      console.warn('[generate-performance-insights] usage log failed:', e);
    }
  }
  return { insights };
});
