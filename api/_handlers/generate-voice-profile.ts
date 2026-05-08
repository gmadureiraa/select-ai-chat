// Migrated from supabase/functions/generate-voice-profile/index.ts
import { anonPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';

interface VoiceProfileSuggestion {
  tone: string;
  use_patterns: string[];
  avoid_patterns: string[];
  detected_expressions: Array<{ expression: string; frequency: number }>;
  style_characteristics: string[];
  analysis_summary: string;
}

export default anonPost(async ({ body }) => {
  const { client_id } = body;
  if (!client_id) throw new Error('client_id é obrigatório');
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error('API key não configurada');

  const pool = getPool();
  const [libraryItems, topPosts, client] = await Promise.all([
    pool.query(
      `SELECT content, content_type, title, metadata, is_favorite FROM client_content_library WHERE client_id = $1 ORDER BY is_favorite DESC NULLS LAST, created_at DESC LIMIT 15`,
      [client_id]
    ).then((r) => r.rows),
    pool.query(
      `SELECT caption, full_content, likes, comments, saves, shares, engagement_rate, is_favorite FROM instagram_posts WHERE client_id = $1 ORDER BY is_favorite DESC NULLS LAST, engagement_rate DESC NULLS LAST LIMIT 10`,
      [client_id]
    ).then((r) => r.rows),
    queryOne<any>(`SELECT identity_guide, voice_profile, description, name FROM clients WHERE id = $1`, [client_id]),
  ]);

  const samples: string[] = [];
  for (const it of libraryItems) {
    if (it.content) samples.push(`[${it.content_type}] ${String(it.content).slice(0, 1000)}`);
  }
  for (const p of topPosts) {
    const text = p.full_content || p.caption || '';
    if (text) {
      const eng = p.engagement_rate ? ` (Engagement: ${Number(p.engagement_rate).toFixed(2)}%)` : '';
      samples.push(`[Instagram${eng}] ${String(text).slice(0, 800)}`);
    }
  }
  if (samples.length < 3) {
    return { error: 'Conteúdo insuficiente para análise', details: 'Adicione pelo menos 3 conteúdos na biblioteca ou conecte o Instagram.' };
  }

  const analysisPrompt = `Você é um especialista em análise de tom de voz e padrões de comunicação.

## TAREFA
Analise os conteúdos abaixo de ${client?.name || 'este cliente'} e extraia:

1. **Tom predominante**: Descreva em 2-3 palavras
2. **Padrões a USAR**: 5-10 expressões/estruturas recorrentes
3. **Padrões a EVITAR**: 3-5 coisas que o autor evita
4. **Expressões mais frequentes** com % de aparição
5. **Características de estilo**: tamanho de parágrafos, listas, emojis, ritmo

## CONTEÚDOS PARA ANÁLISE
${samples.slice(0, 10).join('\n\n---\n\n')}

## FORMATO DE RESPOSTA (JSON)
{
  "tone": "...",
  "use_patterns": ["..."],
  "avoid_patterns": ["..."],
  "detected_expressions": [{"expression": "...", "frequency": 80}],
  "style_characteristics": ["..."],
  "analysis_summary": "..."
}

Responda APENAS com o JSON, sem markdown.`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      }),
    }
  );
  if (!r.ok) {
    const t = await r.text();
    console.error('[VOICE-PROFILE] AI error:', t);
    throw new Error('Erro ao analisar conteúdo');
  }
  const result = await r.json();
  const aiOutput: string = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let suggestion: VoiceProfileSuggestion;
  try {
    const cleaned = aiOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    suggestion = JSON.parse(cleaned);
  } catch (e) {
    console.error('[VOICE-PROFILE] Parse error', e, aiOutput);
    return { error: 'Erro ao processar análise', raw_output: aiOutput.slice(0, 500) };
  }
  return { success: true, suggestion, samples_analyzed: samples.length, current_profile: client?.voice_profile };
});
