// Migrated from supabase/functions/analyze-youtube-sentiment/index.ts
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

export default authedPost(async ({ body, user }) => {
  const { clientId, comments } = body;
  if (!clientId) throw new Error('clientId is required');
  await assertClientAccess(user.id, clientId);

  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  if (!comments || comments.length === 0) {
    return { score: 50, label: 'Neutro', totalComments: 0, insights: ['Sem comentários suficientes'] };
  }

  const commentsToAnalyze = comments.slice(0, 50);
  const commentsText = commentsToAnalyze
    .map((c: any) => (typeof c === 'string' ? c : c.text || c.comment || ''))
    .filter(Boolean)
    .join('\n---\n');

  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
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
    }),
  });
  if (!r.ok) throw new Error(`AI gateway error: ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || '';

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
