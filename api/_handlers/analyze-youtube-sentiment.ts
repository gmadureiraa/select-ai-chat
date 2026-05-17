// Migrated from supabase/functions/analyze-youtube-sentiment/index.ts
// 2026-05-16 — Lovable Gateway morto; trocado por callLLM + Gemini 2.5 Flash Lite.
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import { callLLM, isLLMConfigured } from '../_lib/llm.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, comments } = body;
  if (!clientId) throw new Error('clientId is required');
  await assertClientAccess(user.id, clientId);

  if (!comments || comments.length === 0) {
    return { score: 50, label: 'Neutro', totalComments: 0, insights: ['Sem comentários suficientes'] };
  }

  if (!isLLMConfigured()) {
    throw new Error('Nenhum provider LLM configurado (GOOGLE_AI_STUDIO_API_KEY ou OPENAI_API_KEY).');
  }

  const commentsToAnalyze = comments.slice(0, 50);
  const commentsText = commentsToAnalyze
    .map((c: any) => (typeof c === 'string' ? c : c.text || c.comment || ''))
    .filter(Boolean)
    .join('\n---\n');

  const llmResult = await callLLM(
    [
      {
        role: 'system',
        content: `Você é um analista de sentimento de audiência. Analise os comentários e retorne JSON com:
- score: 0-100 (0 muito negativo, 50 neutro, 100 muito positivo)
- label: "Ruim" | "Regular" | "Neutro" | "Bom" | "Excelente"
- insights: array com 2-3 insights curtos

Retorne APENAS o JSON, sem markdown.`,
      },
      { role: 'user', content: `Analise estes ${commentsToAnalyze.length} comentários do YouTube:\n\n${commentsText}` },
    ],
    {
      model: 'gemini-2.5-flash-lite',
      temperature: 0.3,
      maxTokens: 1024,
      usageContext: {
        userId: user.id,
        edgeFunction: 'analyze-youtube-sentiment',
        clientId,
        metadata: { comments_count: commentsToAnalyze.length },
      },
    },
  );
  const content = llmResult.content || '';

  let result: any;
  try {
    const clean = content.replace(/```json\n?|\n?```/g, '').trim();
    result = JSON.parse(clean);
  } catch {
    result = { score: 50, label: 'Neutro', insights: ['Análise em processamento'] };
  }

  const today = new Date().toISOString().split('T')[0];
  try {
    await getPool().query(
      `INSERT INTO platform_metrics (client_id, platform, metric_date, metadata)
       VALUES ($1, 'youtube', $2, $3::jsonb)
       ON CONFLICT (client_id, platform, metric_date) DO UPDATE SET metadata = platform_metrics.metadata || EXCLUDED.metadata`,
      [
        clientId,
        today,
        JSON.stringify({
          sentiment_score: result.score,
          sentiment_label: result.label,
          sentiment_insights: result.insights,
          sentiment_updated_at: new Date().toISOString(),
          comments_analyzed: commentsToAnalyze.length,
        }),
      ]
    );
  } catch (e) {
    console.warn('[analyze-youtube-sentiment] save failed:', e);
  }

  return {
    score: result.score || 50,
    label: result.label || 'Neutro',
    totalComments: commentsToAnalyze.length,
    insights: result.insights || [],
  };
});
