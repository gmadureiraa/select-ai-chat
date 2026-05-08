// Migrated from supabase/functions/kai-metrics-agent/index.ts
// NOTE: response is streamed (SSE) — uses res.write directly
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';

function buildMetricsContext(metrics: any[], posts: any[], clientName?: string): string {
  if (metrics.length === 0 && posts.length === 0) return 'Não há dados de métricas disponíveis para este cliente.';
  let context = `## Dados de ${clientName || 'Cliente'}\n\n`;
  const byPlatform: Record<string, any[]> = {};
  for (const m of metrics) {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
    byPlatform[m.platform].push(m);
  }
  for (const [platform, data] of Object.entries(byPlatform)) {
    context += `### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
    const totalFollowerGrowth = data.reduce((s, m) => s + (m.subscribers || 0), 0);
    if (totalFollowerGrowth !== 0) {
      context += `- Crescimento de seguidores no período (soma dos registros diários): ${totalFollowerGrowth >= 0 ? '+' : ''}${totalFollowerGrowth.toLocaleString('pt-BR')}\n`;
      context += `- Registros diários de crescimento:\n`;
      data.slice(0, 10).forEach((m) => { context += `  • ${m.metric_date}: ${m.subscribers >= 0 ? '+' : ''}${m.subscribers || 0}\n`; });
      if (data.length > 10) context += `  • ... e mais ${data.length - 10} registros\n`;
    }
    const avgEngagement = data.reduce((s, m) => s + (m.engagement_rate || 0), 0) / data.length;
    if (avgEngagement > 0) context += `- Engajamento médio: ${avgEngagement.toFixed(2)}%\n`;
    const totalLikes = data.reduce((s, m) => s + (m.likes || 0), 0);
    const totalComments = data.reduce((s, m) => s + (m.comments || 0), 0);
    const totalViews = data.reduce((s, m) => s + (m.views || 0), 0);
    if (totalLikes) context += `- Curtidas totais: ${totalLikes.toLocaleString('pt-BR')}\n`;
    if (totalComments) context += `- Comentários totais: ${totalComments.toLocaleString('pt-BR')}\n`;
    if (totalViews) context += `- Views totais: ${totalViews.toLocaleString('pt-BR')}\n`;
    context += `\n`;
  }
  if (posts.length > 0) {
    context += `### Posts Recentes (${posts.length})\n`;
    const avgLikes = posts.reduce((s, p) => s + (p.likes || 0), 0) / posts.length;
    const avgComments = posts.reduce((s, p) => s + (p.comments || 0), 0) / posts.length;
    const avgEngagement = posts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / posts.length;
    context += `- Média de curtidas: ${avgLikes.toFixed(0)}\n- Média de comentários: ${avgComments.toFixed(0)}\n- Engajamento médio: ${avgEngagement.toFixed(2)}%\n\n`;
    const sorted = [...posts].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
    context += `**Top 3 posts:**\n`;
    sorted.slice(0, 3).forEach((p, i) => {
      context += `${i + 1}. ${p.post_type || 'Post'} - ${(p.engagement_rate || 0).toFixed(2)}% eng, ${p.likes || 0} likes\n`;
      if (p.caption) context += `   "${p.caption.slice(0, 80)}${p.caption.length > 80 ? '...' : ''}"\n`;
    });
  }
  return context;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : (req.body ? JSON.parse(req.body) : {});
    const { clientId, question, period, platform } = body;
    if (!clientId) return jsonError(res, 400, 'clientId é obrigatório');

    const pool = getPool();
    const metricsRes = platform
      ? await pool.query(`SELECT * FROM platform_metrics WHERE client_id = $1 AND platform = $2 ORDER BY metric_date DESC LIMIT 60`, [clientId, platform])
      : await pool.query(`SELECT * FROM platform_metrics WHERE client_id = $1 ORDER BY metric_date DESC LIMIT 60`, [clientId]);
    const metrics = metricsRes.rows;
    const postsRes = await pool.query(`SELECT * FROM instagram_posts WHERE client_id = $1 ORDER BY posted_at DESC LIMIT 30`, [clientId]);
    const posts = postsRes.rows;
    const client = await queryOne<any>(`SELECT name FROM clients WHERE id = $1`, [clientId]);

    const metricsContext = buildMetricsContext(metrics, posts, client?.name);
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) return jsonError(res, 500, 'LOVABLE_API_KEY não configurada');

    const systemPrompt = `Você é um especialista em análise de métricas de redes sociais.
Responda de forma clara e acionável, com insights específicos baseados nos dados fornecidos.
Use números formatados e porcentagens quando relevante.
Seja conciso mas completo.

REGRAS CRÍTICAS PARA MÉTRICAS:
1. NUNCA invente números. Se não houver dados suficientes, diga claramente "Não tenho dados para esse período".
2. O campo 'subscribers' representa o CRESCIMENTO DIÁRIO de seguidores, NÃO o total de seguidores.
3. Para calcular crescimento total em um período, você deve SOMAR todos os valores diários do período.
4. Se os dados parecerem inconsistentes ou incompletos, avise o usuário.
5. Sempre cite a fonte: "De acordo com os dados registrados...".
6. Mostre o cálculo quando relevante.

${metricsContext}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }],
        stream: true,
      }),
    });
    if (!aiResponse.ok || !aiResponse.body) {
      const t = await aiResponse.text();
      console.error('AI error:', t);
      return jsonError(res, 500, 'Erro ao processar análise');
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (e: any) {
    console.error('Metrics agent error:', e);
    if (!res.writableEnded) jsonError(res, 500, e?.message || 'Erro desconhecido');
  }
}
