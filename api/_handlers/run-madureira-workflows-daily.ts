// Cron handler: roda diariamente todos os ai_workflows do agente madureira-redes
// que devem disparar HOJE conforme `schedule_cron`.
//
// Por que centralizado: Vercel Hobby plan = 2 daily crons. Em vez de 1 cron por
// workflow, este handler resolve quais workflows estão "due" baseado no dia da
// semana e dispara cada um sequencialmente.
//
// Auth: x-vercel-cron OR Authorization: Bearer ${CRON_SECRET}
// Triggered by: cron-radar-master (que já roda 7am UTC) — fire-and-forget.
//
// Cada workflow:
//   1. Lê config + agent.knowledge_base
//   2. Monta prompt (template do format_schemas + frames proibidos)
//   3. Chama Gemini (model do agent)
//   4. Valida (regex frames proibidos + prohibited_phrases)
//   5. Se passou: INSERT em planning_items com status='idea' + due_date
//   6. Loga em ai_workflow_runs (output, violations, duration, cost)
//
// MVP: ainda não implementa repair loop (regenera se validator falhar).
// Marca run como `failed_validation` e Gabriel decide.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, query, queryOne } from '../_lib/db.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const DEFAULT_MODEL = 'gemini-2.5-flash';

interface WorkflowRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  name: string;
  schedule_cron: string;
  config: Record<string, any>;
}

interface AgentRow {
  id: string;
  name: string;
  skill_id: string | null;
  knowledge_base: Record<string, any>;
  sub_agents: Record<string, any>;
  model: string | null;
}

/**
 * Resolve se um cron expression dispara HOJE no horário próximo de `now`.
 * Implementação simples — só considera dia-da-semana e dia-do-mês.
 * (Hora exata fica pra Vercel cron/scheduler decidir QUANDO chamar.)
 */
function isDueToday(cron: string, now: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [, , dom, , dow] = parts;
  const today = now.getUTCDay();
  const todayMonth = now.getUTCDate();

  if (dow !== '*') {
    const days = dow.split(',').flatMap((d) => {
      if (d.includes('-')) {
        const [a, b] = d.split('-').map(Number);
        return Array.from({ length: b - a + 1 }, (_, i) => a + i);
      }
      return [Number(d)];
    });
    if (!days.includes(today)) return false;
  }

  if (dom !== '*') {
    const dates = dom.split(',').map(Number);
    if (!dates.includes(todayMonth)) return false;
  }

  return true;
}

const PROHIBITED_PHRASES_DEFAULT = [
  'simplesmente',
  'incrível',
  'transformador',
  'revolucionário',
  'game-changer',
  'gurus',
  'mindset',
  'entregar valor',
  'agregar valor',
  'jornada',
  'ecossistema',
  'quase ninguém',
  'a escolha que custa caro',
  'você tá usando errado',
  'você está fazendo errado',
  'você precisa entender',
  'você deveria',
  'hot take 🔥',
  'unpopular opinion 🔥',
  'compartilhe com alguém',
  'sua opinião nos comentários',
  'se você chegou até aqui',
  '🧵 thread',
];

const PROHIBITED_PATTERNS = [
  / — /,            // travessão em corpo
  /[\u{1F300}-\u{1F9FF}]{2,}/u, // 2+ emoji seguidos
  /^\d+\s+(coisas?|ferramentas?|dicas?|formas?|jeitos?|maneiras?)\s+que/i,
];

function findViolations(text: string, allowHashtag = false): string[] {
  const violations: string[] = [];
  const lower = text.toLowerCase();
  for (const phrase of PROHIBITED_PHRASES_DEFAULT) {
    if (lower.includes(phrase.toLowerCase())) violations.push(`phrase:${phrase}`);
  }
  for (const pat of PROHIBITED_PATTERNS) {
    if (pat.test(text)) violations.push(`pattern:${pat.source}`);
  }
  if (!allowHashtag && /#\w+/.test(text)) {
    violations.push('pattern:hashtag');
  }
  return violations;
}

function buildPrompt(workflow: WorkflowRow, agent: AgentRow): string {
  const cfg = workflow.config ?? {};
  const kb = agent.knowledge_base ?? {};
  const pilarHoje = cfg.pilar_dia ?? 'marketing';
  const proibidos = (kb.frames_proibidos ?? PROHIBITED_PHRASES_DEFAULT).slice(0, 20).join(', ');
  const tecnicas = (kb.tecnicas_obrigatorias ?? [
    'hook-passa-3-testes',
    'cena-kaleidos-real',
    'tres-detalhes-especificos',
    'voz-ativa',
    'primeira-pessoa',
    'cta-organico',
  ]).join(', ');

  const platformRules = (() => {
    switch (workflow.config?.platform) {
      case 'instagram':
        if (workflow.config?.content_type === 'instagram_reel') {
          return `REEL Instagram. Duração 30-60s. Hook nos 3 primeiros segundos passa nos 3 testes. Caption ≤500 chars, zero hashtag. Se face_cam: cena Kaleidos real no body.`;
        }
        return `CARROSSEL Instagram, ${cfg.slides_min ?? 8}-${cfg.slides_max ?? 12} slides. Capa ${cfg.capa_format ?? 'F1'}. Slide 02 OBRIGATÓRIO com cena Kaleidos real (eu/a gente/na Kaleidos/cliente real). 3+ dados específicos. Caption 100-800 chars com pilar + dado + CTA orgânico, ZERO hashtag.`;
      case 'linkedin':
        return `POST LinkedIn ${cfg.rotation_by_weekday?.[new Date().getUTCDay()] ?? 'curto'}. Primeira linha ≤200 chars (LI corta após 3 linhas). Cena Kaleidos OBRIGATÓRIA. ≥1 dado numérico real (R$/%/clientes/meses). Zero hashtag, zero emoji em rajada. CTA = pergunta específica OU convite reflexão (NÃO "comenta aí").`;
      case 'twitter':
        if (workflow.config?.content_type === 'thread') {
          return `THREAD X em PT-BR rigoroso (nunca inglês). ${cfg.tweets_min ?? 12}-${cfg.tweets_max ?? 18} tweets. Tweet 1: hook completo passa nos 3 testes + cena Kaleidos OU número. Tweets 2-12: 1 ideia/tweet com prova. Penúltimo tweet: takeaway forte. Último tweet: CTA orgânico. Zero hashtag, zero "🧵 Thread".`;
        }
        return `BATCH de ${cfg.batch_size ?? 5} TWEETS em PT-BR. Distribuição: 1 hot take cena Kaleidos, 1 dado-shock IA/marketing, 1 repurpose carrossel/thread, 1 pergunta provocativa, 1 contrarian. Cada ≤280 chars. Hook nos primeiros 50 chars. 0-1 emoji. Sem hashtag, sem "thread 🧵".`;
      case 'threads':
        return `POST Threads. Espelho de último carrossel IG ou thread X aprovado. Adicione 1-2 hot takes nativos. Caption ≤500 chars, zero hashtag.`;
      case 'tiktok':
        return `BATCH de ${cfg.batch_size ?? 5} ROTEIROS TikTok. Hook nos 3 primeiros segundos OBRIGATÓRIO. Duração ${cfg.duration_min ?? 30}-${cfg.duration_max ?? 90}s. PT-BR. Caption ≤300 chars. ${cfg.hashtags_min ?? 5}-${cfg.hashtags_max ?? 8} hashtags niche. Se face_cam: cena Kaleidos real.`;
      default:
        return '';
    }
  })();

  return `Você é o ${agent.name} do KAI gerando conteúdo pro Gabriel Madureira (@ogmadureira).

CLIENTE: Madureira (KAI client_id ${cfg.client_id})
PILAR DE HOJE: ${pilarHoje}
SKILL OBRIGATÓRIA: ${agent.skill_id ?? 'copywriting-madureira@1.2'}
TÉCNICAS OBRIGATÓRIAS: ${tecnicas}
FRAMES PROIBIDOS (NUNCA USAR): ${proibidos}

REGRA #1: Skill v1.2 obrigatória. Cena Kaleidos real, primeira pessoa, dado numérico no 1º ou 2º parágrafo, voz ativa, CTA orgânico (nunca "comenta aí" / "salva isso" / "se você chegou até aqui").
REGRA #2: PT-BR rigoroso. Português brasileiro coloquial mas direto.
REGRA #3: Travessão (—) PROIBIDO no corpo.

${platformRules}

OUTPUT: JSON com:
{
  "tema": "...",
  "pilar": "${pilarHoje}",
  "title": "título curto pro card",
  "content": { /* estrutura específica do formato — ver platformRules */ },
  "caption": "...",
  "metadata": {
    "skill_aplicada": "copywriting-madureira@1.2",
    "formato": "${cfg.format ?? 'unknown'}",
    "pilar": "${pilarHoje}"
  }
}`;
}

async function callGemini(prompt: string, model: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (!GEMINI_API_KEY) return { ok: false, error: 'GEMINI_API_KEY missing' };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            responseMimeType: 'application/json',
          },
        }),
      },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `${res.status}: ${t.slice(0, 200)}` };
    }
    const json = (await res.json()) as any;
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { ok: true, text };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'unknown' };
  }
}

async function runWorkflow(workflow: WorkflowRow, agent: AgentRow): Promise<{
  ok: boolean;
  planningItemIds: string[];
  violations: string[];
  error?: string;
  durationMs: number;
}> {
  const started = Date.now();
  const prompt = buildPrompt(workflow, agent);
  const model = agent.model || DEFAULT_MODEL;
  const gen = await callGemini(prompt, model);

  if (!gen.ok || !gen.text) {
    return {
      ok: false,
      planningItemIds: [],
      violations: [],
      error: gen.error ?? 'no text',
      durationMs: Date.now() - started,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(gen.text);
  } catch {
    return {
      ok: false,
      planningItemIds: [],
      violations: [`parse_error`],
      error: 'JSON invalid',
      durationMs: Date.now() - started,
    };
  }

  const allowHashtag = workflow.config?.platform === 'tiktok';
  const flat = JSON.stringify(parsed);
  const violations = findViolations(flat, allowHashtag);

  // Insere planning_item mesmo com violations (status='pending-validation' se houver)
  const status = violations.length > 0 ? 'pending-validation' : (workflow.config?.status_after_generation ?? 'idea');
  const dueOffsetDays = Number(workflow.config?.due_date_offset_days ?? 0);
  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + dueOffsetDays);
  const dueDateIso = dueDate.toISOString().slice(0, 10);

  const items: any[] = Array.isArray(parsed) ? parsed : [parsed];
  const insertedIds: string[] = [];

  for (const item of items) {
    try {
      const r = await query<{ id: string }>(
        `INSERT INTO public.planning_items
           (workspace_id, client_id, platform, content_type, status,
            title, content, due_date, metadata)
         VALUES ($1, $2, $3, $4::content_type, $5,
                 $6, $7, $8::date, $9::jsonb)
         RETURNING id`,
        [
          workflow.workspace_id,
          workflow.config?.client_id,
          workflow.config?.platform,
          workflow.config?.content_type ?? 'social_post',
          status,
          (item.title ?? item.tema ?? `${workflow.name} ${dueDateIso}`).slice(0, 180),
          item.content?.body ?? item.caption ?? JSON.stringify(item).slice(0, 5000),
          dueDateIso,
          JSON.stringify({
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            agent: agent.name,
            generated: item,
            violations,
          }),
        ],
      );
      if (r?.[0]?.id) insertedIds.push(r[0].id);
    } catch (insErr: any) {
      console.error(`[madureira] insert failed:`, insErr?.message);
    }
  }

  return {
    ok: insertedIds.length > 0,
    planningItemIds: insertedIds,
    violations,
    durationMs: Date.now() - started,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) return res.status(401).json({ error: 'Unauthorized' });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 1. Lista workflows ativos do Madureira
  const workflows = await query<WorkflowRow>(
    `SELECT id, workspace_id, agent_id, name, schedule_cron, config
       FROM ai_workflows
      WHERE is_active = true
        AND name LIKE 'madureira-%'`,
  );

  // 2. Filtra os que devem disparar HOJE
  const due = workflows.filter((w) => isDueToday(w.schedule_cron, now));

  if (due.length === 0) {
    return res.status(200).json({
      ok: true,
      date: today,
      total_workflows: workflows.length,
      due_today: 0,
      message: 'Nenhum workflow Madureira agendado pra hoje',
    });
  }

  // 3. Carrega agent
  const agent = await queryOne<AgentRow>(
    `SELECT id, name, skill_id, knowledge_base, sub_agents, model
       FROM ai_agents
      WHERE name = 'agent-madureira-redes'
      LIMIT 1`,
  );

  if (!agent) {
    return res.status(500).json({
      ok: false,
      error: 'agent-madureira-redes não encontrado',
    });
  }

  // 4. Idempotência: se já rodou hoje, skip
  const skipNames: string[] = [];
  for (const w of due) {
    const last = await queryOne<{ id: string }>(
      `SELECT id FROM ai_workflow_runs
        WHERE workflow_id = $1
          AND date_trunc('day', started_at) = date_trunc('day', now())
          AND status = 'completed'
        LIMIT 1`,
      [w.id],
    );
    if (last) skipNames.push(w.name);
  }
  const todoWorkflows = due.filter((w) => !skipNames.includes(w.name));

  // 5. Executa cada workflow sequencial (pra não estourar Gemini rate-limit)
  const results: any[] = [];
  for (const w of todoWorkflows) {
    let runId: string | null = null;
    try {
      const ins = await query<{ id: string }>(
        `INSERT INTO ai_workflow_runs (workflow_id, status, started_at)
         VALUES ($1, 'running', now())
         RETURNING id`,
        [w.id],
      );
      runId = ins?.[0]?.id ?? null;

      const out = await runWorkflow(w, agent);
      results.push({
        workflow: w.name,
        ok: out.ok,
        items: out.planningItemIds.length,
        violations: out.violations,
        error: out.error,
      });

      if (runId) {
        await query(
          `UPDATE ai_workflow_runs
              SET status = $1,
                  output = $2::jsonb,
                  violations = $3::jsonb,
                  duration_ms = $4,
                  finished_at = now(),
                  error = $5
            WHERE id = $6`,
          [
            out.ok ? 'completed' : 'failed',
            JSON.stringify(out.planningItemIds),
            JSON.stringify(out.violations),
            out.durationMs,
            out.error ?? null,
            runId,
          ],
        );
      }

      await query(
        `UPDATE ai_workflows SET last_run_at = now() WHERE id = $1`,
        [w.id],
      );
    } catch (err: any) {
      console.error(`[madureira] workflow ${w.name} crashed:`, err?.message);
      results.push({ workflow: w.name, ok: false, error: err?.message });
      if (runId) {
        await query(
          `UPDATE ai_workflow_runs SET status = 'crashed', error = $1, finished_at = now() WHERE id = $2`,
          [err?.message ?? 'unknown', runId],
        );
      }
    }
  }

  return res.status(200).json({
    ok: true,
    date: today,
    total_workflows: workflows.length,
    due_today: due.length,
    skipped_already_ran_today: skipNames,
    executed: results,
  });
}
