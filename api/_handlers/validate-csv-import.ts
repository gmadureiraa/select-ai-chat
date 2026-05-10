// Migrated from supabase/functions/validate-csv-import/index.ts
import { anonPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';

type DateRange = { start: string; end: string };
const MODEL = 'google/gemini-2.5-flash';

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}
function getMetaValue(metric: any, key: string): number | null {
  const meta = metric?.metadata;
  if (!meta || typeof meta !== 'object') return null;
  return safeNumber((meta as Record<string, unknown>)[key]);
}
function computeDateRangeFromMetrics(metrics: any[]): DateRange | null {
  const dates = (metrics || []).map((m) => (typeof m.metric_date === 'string' ? m.metric_date : null)).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  dates.sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

export default anonPost(async ({ body, user }) => {
  const { clientId, platform, importedCount, dateRange, userId, importTypes, fileName } = body;
  if (user && clientId) await assertClientAccess(user.id, clientId);

  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  const pool = getPool();
  let metrics: any[] = [];
  if (hasDateRange) {
    const r = await pool.query(
      `SELECT * FROM platform_metrics WHERE client_id = $1 AND platform = $2 AND metric_date >= $3 AND metric_date <= $4 ORDER BY metric_date DESC LIMIT 1000`,
      [clientId, platform, dateRange.start, dateRange.end]
    );
    metrics = r.rows;
  } else {
    const r = await pool.query(
      `SELECT * FROM platform_metrics WHERE client_id = $1 AND platform = $2 ORDER BY metric_date DESC LIMIT 60`,
      [clientId, platform]
    );
    metrics = r.rows;
  }
  const effectiveDateRange: DateRange | null = hasDateRange ? dateRange : computeDateRangeFromMetrics(metrics);
  const typesArr: string[] = Array.isArray(importTypes) ? importTypes : [];

  const nonNullCounts = {
    views: 0, likes: 0, comments: 0, shares: 0, subscribers: 0,
    engagement_rate: 0, open_rate: 0, click_rate: 0,
    linkClicks: 0, reach: 0, interactions: 0, profileVisits: 0,
  };
  for (const m of metrics) {
    if (m.views != null) nonNullCounts.views++;
    if (m.likes != null) nonNullCounts.likes++;
    if (m.comments != null) nonNullCounts.comments++;
    if (m.shares != null) nonNullCounts.shares++;
    if (m.subscribers != null) nonNullCounts.subscribers++;
    if (m.engagement_rate != null) nonNullCounts.engagement_rate++;
    if (m.open_rate != null) nonNullCounts.open_rate++;
    if (m.click_rate != null) nonNullCounts.click_rate++;
    if (getMetaValue(m, 'linkClicks') !== null) nonNullCounts.linkClicks++;
    if (getMetaValue(m, 'reach') !== null) nonNullCounts.reach++;
    if (getMetaValue(m, 'interactions') !== null) nonNullCounts.interactions++;
    if (getMetaValue(m, 'profileVisits') !== null) nonNullCounts.profileVisits++;
  }

  const dataSummary = {
    totalRecords: metrics.length,
    platform, importedCount, dateRange: effectiveDateRange,
    importTypes: typesArr, fileName: typeof fileName === 'string' ? fileName : null,
    sampleData: metrics.slice(0, 10).map((m) => ({
      date: m.metric_date, views: m.views, likes: m.likes, comments: m.comments,
      shares: m.shares, subscribers: m.subscribers, engagement_rate: m.engagement_rate,
      open_rate: m.open_rate, click_rate: m.click_rate,
      linkClicks: getMetaValue(m, 'linkClicks'), reach: getMetaValue(m, 'reach'),
      interactions: getMetaValue(m, 'interactions'), profileVisits: getMetaValue(m, 'profileVisits'),
    })),
    stats: {
      avgViews: metrics.length ? Math.round(metrics.reduce((s, m) => s + (m.views || 0), 0) / metrics.length) : 0,
      avgEngagement: metrics.length ? (metrics.reduce((s, m) => s + (m.engagement_rate || 0), 0) / metrics.length).toFixed(2) : '0',
      maxViews: metrics.length ? Math.max(...metrics.map((m) => m.views || 0)) : 0,
      minViews: metrics.length ? Math.min(...metrics.filter((m) => m.views).map((m) => m.views || 0)) : 0,
      hasNulls: metrics.some((m) => {
        const meta = { linkClicks: getMetaValue(m, 'linkClicks'), reach: getMetaValue(m, 'reach'), interactions: getMetaValue(m, 'interactions'), profileVisits: getMetaValue(m, 'profileVisits') };
        return m.views == null && m.likes == null && m.subscribers == null && meta.linkClicks === null && meta.reach === null && meta.interactions === null && meta.profileVisits === null;
      }),
      uniqueDates: new Set(metrics.map((m) => m.metric_date)).size,
      nonNullCounts,
    },
  };

  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) {
    // Return basic validation without AI
    return {
      status: 'success',
      summary: `${importedCount} registros importados com sucesso para ${platform}`,
      details: [`Total de ${dataSummary.totalRecords} registros no banco (recorte)`, `${dataSummary.stats.uniqueDates} datas únicas`],
      issues: [], recommendations: [], aiAnalyzed: false,
      stats: dataSummary.stats, dateRange: effectiveDateRange,
    };
  }

  const systemPrompt = `Você é um analista de dados especializado em métricas de redes sociais.
Analise os dados importados e forneça um relatório de validação em português brasileiro.

IMPORTANTE:
- Importações podem ser PARCIAIS (ex.: apenas "Cliques no link", apenas "Alcance", etc.).
- Em importações parciais, é NORMAL que outras métricas estejam nulas. Não trate isso como erro.
- Se "Registros importados" for maior do que "Total de registros no banco", isso pode ser NORMAL quando há upsert por data (datas únicas).

Responda SEMPRE no formato JSON:
{
  "status": "success" | "warning" | "error",
  "summary": "Uma frase resumindo a importação",
  "details": ["Lista de observações importantes"],
  "issues": ["Lista de problemas encontrados, se houver"],
  "recommendations": ["Sugestões de melhoria, se aplicável"]
}`;

  const userPrompt = `Analise esta importação de dados de ${platform}:
Arquivo(s): ${dataSummary.fileName || 'N/A'}
Tipos detectados: ${typesArr.length ? typesArr.join(', ') : 'N/A'}
Registros importados (contagem do app): ${importedCount}
Total de registros analisados no banco (no período/recorte): ${dataSummary.totalRecords}
Período: ${effectiveDateRange?.start || 'N/A'} até ${effectiveDateRange?.end || 'N/A'}

Cobertura (quantos registros têm valor):
- views: ${nonNullCounts.views}/${dataSummary.totalRecords}
- subscribers: ${nonNullCounts.subscribers}/${dataSummary.totalRecords}
- engagement_rate: ${nonNullCounts.engagement_rate}/${dataSummary.totalRecords}
- linkClicks (metadata): ${nonNullCounts.linkClicks}/${dataSummary.totalRecords}
- reach (metadata): ${nonNullCounts.reach}/${dataSummary.totalRecords}
- interactions (metadata): ${nonNullCounts.interactions}/${dataSummary.totalRecords}
- profileVisits (metadata): ${nonNullCounts.profileVisits}/${dataSummary.totalRecords}

Amostra dos dados (até 10 registros mais recentes do recorte):
${JSON.stringify(dataSummary.sampleData, null, 2)}`;

  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.3,
    }),
  });

  if (!aiResponse.ok) {
    return {
      status: 'success',
      summary: `${importedCount} registros importados com sucesso para ${platform}`,
      details: [`Total de ${dataSummary.totalRecords} registros no banco (recorte)`, `${dataSummary.stats.uniqueDates} datas únicas`],
      issues: [], recommendations: [], aiAnalyzed: false,
      stats: dataSummary.stats, dateRange: effectiveDateRange,
    };
  }

  const aiData = await aiResponse.json();
  const aiContent: string = aiData.choices?.[0]?.message?.content || '';
  const inputTokens = aiData.usage?.prompt_tokens || Math.ceil((systemPrompt + userPrompt).length / 4);
  const outputTokens = aiData.usage?.completion_tokens || Math.ceil(aiContent.length / 4);

  if (userId) {
    try {
      await pool.query(
        `INSERT INTO ai_usage_logs (user_id, model, edge_function, input_tokens, output_tokens, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
        [userId, MODEL, 'validate-csv-import', inputTokens, outputTokens, JSON.stringify({ clientId, platform, importedCount, importTypes: typesArr, fileName: dataSummary.fileName, dateRange: effectiveDateRange })]
      );
    } catch (e) {
      console.warn('usage log failed:', e);
    }
  }

  let validationResult: any;
  try {
    const m = aiContent.match(/\{[\s\S]*\}/);
    if (m) validationResult = JSON.parse(m[0]);
    else throw new Error('No JSON');
  } catch {
    validationResult = {
      status: 'success',
      summary: `${importedCount} registros importados para ${platform}`,
      details: [aiContent], issues: [], recommendations: [],
    };
  }
  const isOnlyLinkClicks = platform === 'instagram' && typesArr.length === 1 && typesArr[0] === 'link_clicks';
  if (isOnlyLinkClicks && nonNullCounts.linkClicks > 0) {
    if (validationResult.status === 'error') validationResult.status = 'success';
    if (typeof validationResult.summary === 'string') validationResult.summary = 'Importação de Cliques no Link do Instagram concluída.';
    if (Array.isArray(validationResult.issues)) {
      validationResult.issues = validationResult.issues.filter((i: string) => {
        const s = (i || '').toLowerCase();
        return !(s.includes('views') || s.includes('open_rate') || s.includes('click_rate'));
      });
    }
  }

  return { ...validationResult, aiAnalyzed: true, stats: dataSummary.stats, dateRange: effectiveDateRange };
});
