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
import { assertCronAuth } from '../_lib/cron-auth.js';

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

function isBatchWorkflow(cfg: Record<string, any>): boolean {
  if (cfg.platform === 'twitter' && cfg.content_type === 'tweet') return true;
  if (cfg.platform === 'tiktok') return true;
  return false;
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
          return `REEL Instagram. Duração 30-60s. Hook nos 3 primeiros segundos passa nos 3 testes. Caption ≤500 chars, zero hashtag. Se face_cam: cena Kaleidos real no body. Estrutura content: { formato_reel, hook_3s, body_script, cta_script, duracao_segundos }.`;
        }
        return `CARROSSEL Instagram, ${cfg.slides_min ?? 8}-${cfg.slides_max ?? 12} slides. Capa ${cfg.capa_format ?? 'F1'}. Slide 02 OBRIGATÓRIO com cena Kaleidos real (eu/a gente/na Kaleidos/cliente real). 3+ dados específicos. Caption 100-800 chars com pilar + dado + CTA orgânico, ZERO hashtag. Estrutura content: { capa_format, cena_kaleidos, dados_concretos: [...], slides: [{ index, type, text }] }.`;
      case 'linkedin':
        return `POST LinkedIn ${cfg.rotation_by_weekday?.[new Date().getUTCDay()] ?? 'curto'}. Primeira linha ≤200 chars (LI corta após 3 linhas). Cena Kaleidos OBRIGATÓRIA. ≥1 dado numérico real (R$/%/clientes/meses). Zero hashtag, zero emoji em rajada. CTA = pergunta específica OU convite reflexão (NÃO "comenta aí"). Use o campo "caption" como o post completo (LinkedIn não tem texto separado de caption).`;
      case 'twitter':
        if (workflow.config?.content_type === 'thread') {
          return `THREAD X em PT-BR rigoroso (nunca inglês). ${cfg.tweets_min ?? 12}-${cfg.tweets_max ?? 18} tweets. Tweet 1: hook completo passa nos 3 testes + cena Kaleidos OU número. Tweets 2-12: 1 ideia/tweet com prova. Penúltimo tweet: takeaway forte. Último tweet: CTA orgânico. Zero hashtag, zero "🧵 Thread". Estrutura content: { tweets: ["tweet 1", "tweet 2", ...] }. Use também caption = todos os tweets concatenados separados por "\\n\\n---\\n\\n".`;
        }
        // Batch tweets
        return `BATCH de ${cfg.batch_size ?? 5} TWEETS em PT-BR. Distribuição: 1 hot take cena Kaleidos, 1 dado-shock IA/marketing, 1 repurpose carrossel/thread, 1 pergunta provocativa, 1 contrarian. Cada ≤280 chars. Hook nos primeiros 50 chars. 0-1 emoji. Sem hashtag, sem "thread 🧵".`;
      case 'threads':
        return `POST Threads. Hot take nativo direto (1ª pessoa) + cena Kaleidos curta + dado. Caption ≤500 chars, zero hashtag, zero "comenta aí".`;
      case 'tiktok':
        return `BATCH de ${cfg.batch_size ?? 5} ROTEIROS TikTok. Hook nos 3 primeiros segundos OBRIGATÓRIO. Duração ${cfg.duration_min ?? 30}-${cfg.duration_max ?? 90}s. PT-BR. Caption ≤300 chars. ${cfg.hashtags_min ?? 5}-${cfg.hashtags_max ?? 8} hashtags niche. Se face_cam: cena Kaleidos real.`;
      default:
        return '';
    }
  })();

  const isBatch = isBatchWorkflow(workflow.config ?? {});
  const batchSize = workflow.config?.batch_size ?? 5;

  if (isBatch) {
    return `Você é o ${agent.name} do KAI gerando conteúdo pro Gabriel Madureira (@ogmadureira).

CLIENTE: Madureira (KAI client_id ${cfg.client_id})
PILAR DE HOJE: ${pilarHoje}
SKILL OBRIGATÓRIA: ${agent.skill_id ?? 'copywriting-madureira@1.2'}
TÉCNICAS OBRIGATÓRIAS: ${tecnicas}
FRAMES PROIBIDOS (NUNCA USAR): ${proibidos}

REGRA #1: Skill v1.2 obrigatória. Cena Kaleidos real, primeira pessoa, dado numérico no 1º ou 2º parágrafo, voz ativa, CTA orgânico (nunca "comenta aí" / "salva isso" / "se você chegou até aqui").
REGRA #2: PT-BR rigoroso. Português brasileiro coloquial mas direto.
REGRA #3: Travessão (—) PROIBIDO no corpo. Use vírgula/dois-pontos/parênteses.

${platformRules}

OUTPUT OBRIGATÓRIO: ARRAY JSON com EXATAMENTE ${batchSize} items. Cada item:
{
  "tema": "...",
  "pilar": "${pilarHoje}",
  "title": "título curto (≤80 chars)",
  "caption": "TEXTO PUBLICÁVEL DIRETO (o tweet/roteiro completo)",
  "metadata": {
    "skill_aplicada": "copywriting-madureira@1.2",
    "formato": "${cfg.format ?? 'unknown'}",
    "pilar": "${pilarHoje}",
    "tipo_no_batch": "hot_take|dado_shock|repurpose|pergunta|contrarian"
  }
}

Retorne ARRAY JSON puro, sem markdown wrapper, sem texto antes/depois.`;
  }

  return `Você é o ${agent.name} do KAI gerando conteúdo pro Gabriel Madureira (@ogmadureira).

CLIENTE: Madureira (KAI client_id ${cfg.client_id})
PILAR DE HOJE: ${pilarHoje}
SKILL OBRIGATÓRIA: ${agent.skill_id ?? 'copywriting-madureira@1.2'}
TÉCNICAS OBRIGATÓRIAS: ${tecnicas}
FRAMES PROIBIDOS (NUNCA USAR): ${proibidos}

REGRA #1: Skill v1.2 obrigatória. Cena Kaleidos real, primeira pessoa, dado numérico no 1º ou 2º parágrafo, voz ativa, CTA orgânico (nunca "comenta aí" / "salva isso" / "se você chegou até aqui").
REGRA #2: PT-BR rigoroso. Português brasileiro coloquial mas direto.
REGRA #3: Travessão (—) PROIBIDO no corpo. Use vírgula/dois-pontos/parênteses.

${platformRules}

OUTPUT OBRIGATÓRIO: JSON único, sem markdown wrapper:
{
  "tema": "...",
  "pilar": "${pilarHoje}",
  "title": "título curto pro card (≤80 chars)",
  "content": { /* estrutura específica do formato — ver platformRules */ },
  "caption": "TEXTO PUBLICÁVEL DIRETO (caption IG/post LinkedIn/post Threads). Para LinkedIn = post completo. Para IG = caption do carrossel. Para X thread = todos os tweets concatenados.",
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

async function getCreatedByForWorkspace(workspaceId: string): Promise<string | null> {
  const owner = await queryOne<{ owner_id: string }>(
    `SELECT owner_id FROM public.workspaces WHERE id = $1`,
    [workspaceId],
  );
  return owner?.owner_id ?? null;
}

/**
 * Map workflow.config.content_type → valid public.content_type enum value.
 * Enum: newsletter, carousel, reel_script, video_script, blog_post, social_post, other,
 *       stories, static_image, short_video, long_video, tweet, thread, x_article,
 *       linkedin_post, instagram_post, case_study, report.
 */
function normalizeContentType(raw: string | null | undefined): string {
  if (!raw) return 'social_post';
  const map: Record<string, string> = {
    instagram_reel: 'reel_script',
    tiktok_video: 'short_video',
    threads_post: 'social_post',
    twitter_thread: 'thread',
    twitter_tweet: 'tweet',
  };
  if (map[raw]) return map[raw];
  // Already a valid enum value
  const valid = [
    'newsletter', 'carousel', 'reel_script', 'video_script', 'blog_post',
    'social_post', 'other', 'stories', 'static_image', 'short_video',
    'long_video', 'tweet', 'thread', 'x_article', 'linkedin_post',
    'instagram_post', 'case_study', 'report',
  ];
  if (valid.includes(raw)) return raw;
  return 'social_post';
}

async function runWorkflow(workflow: WorkflowRow, agent: AgentRow): Promise<{
  ok: boolean;
  planningItemIds: string[];
  violations: string[];
  error?: string;
  durationMs: number;
  rawOutput?: string;
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
      error: `JSON invalid: ${gen.text.slice(0, 200)}`,
      durationMs: Date.now() - started,
      rawOutput: gen.text,
    };
  }

  const allowHashtag = workflow.config?.platform === 'tiktok';
  const dueOffsetDays = Number(workflow.config?.due_date_offset_days ?? 0);
  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + dueOffsetDays);
  const dueDateIso = dueDate.toISOString().slice(0, 10);

  const items: any[] = Array.isArray(parsed) ? parsed : [parsed];
  const insertedIds: string[] = [];
  const aggregatedViolations: string[] = [];
  const createdBy = await getCreatedByForWorkspace(workflow.workspace_id);

  if (!createdBy) {
    return {
      ok: false,
      planningItemIds: [],
      violations: [],
      error: `workspace ${workflow.workspace_id} has no owner_id`,
      durationMs: Date.now() - started,
    };
  }

  // Resolve target column_id ONCE (per workflow run) so cards land on the Kanban.
  // Sem column_id, planning_items existe no DB mas some do PlanningBoard
  // (KanbanView filtra por column_id). Mapping: workflow status_after_generation
  // → column_type → column_id do workspace.
  const desiredStatus = workflow.config?.status_after_generation ?? 'idea';
  const desiredColumnType =
    desiredStatus === 'approved'
      ? 'approved'
      : desiredStatus === 'draft'
        ? 'draft'
        : 'idea';

  let resolvedColumnId: string | null = null;
  try {
    const colTyped = await queryOne<{ id: string }>(
      `SELECT id FROM public.kanban_columns
         WHERE workspace_id = $1 AND column_type = $2
         ORDER BY position ASC LIMIT 1`,
      [workflow.workspace_id, desiredColumnType],
    );
    resolvedColumnId = colTyped?.id ?? null;
    if (!resolvedColumnId) {
      const colFallback = await queryOne<{ id: string }>(
        `SELECT id FROM public.kanban_columns
           WHERE workspace_id = $1
           ORDER BY position ASC LIMIT 1`,
        [workflow.workspace_id],
      );
      resolvedColumnId = colFallback?.id ?? null;
    }
  } catch (colErr: any) {
    console.warn(`[madureira] kanban_columns lookup failed:`, colErr?.message);
  }

  for (const item of items) {
    // Per-item validation — each post in a batch evaluated independently.
    const itemText = item?.caption ?? item?.content?.body ?? JSON.stringify(item ?? {});
    const itemViolations = findViolations(itemText, allowHashtag);
    aggregatedViolations.push(...itemViolations);
    const itemStatus =
      itemViolations.length > 0
        ? 'pending-validation'
        : desiredStatus;

    try {
      const r = await query<{ id: string }>(
        `INSERT INTO public.planning_items
           (workspace_id, client_id, column_id, platform, content_type, status,
            title, content, due_date, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5::content_type, $6,
                 $7, $8, $9::date, $10::jsonb, $11)
         RETURNING id`,
        [
          workflow.workspace_id,
          workflow.config?.client_id,
          resolvedColumnId,
          workflow.config?.platform,
          normalizeContentType(workflow.config?.content_type),
          itemStatus,
          (item.title ?? item.tema ?? `${workflow.name} ${dueDateIso}`).slice(0, 180),
          item.caption ?? item.content?.body ?? JSON.stringify(item).slice(0, 5000),
          dueDateIso,
          JSON.stringify({
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            agent: agent.name,
            generated: item,
            violations: itemViolations,
          }),
          createdBy,
        ],
      );
      if (r?.[0]?.id) insertedIds.push(r[0].id);
    } catch (insErr: any) {
      console.error(`[madureira] insert failed for ${workflow.name}:`, insErr?.message);
      return {
        ok: false,
        planningItemIds: insertedIds,
        violations: aggregatedViolations,
        error: `insert_failed: ${insErr?.message}`,
        durationMs: Date.now() - started,
      };
    }
  }

  return {
    ok: insertedIds.length > 0,
    planningItemIds: insertedIds,
    violations: aggregatedViolations,
    durationMs: Date.now() - started,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!assertCronAuth(req, res)) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Query params: ?only=<workflow_id> filtra um único workflow (manual test).
  // ?force=1 pula verificação isDueToday e idempotência (force re-run hoje).
  const onlyId = (typeof req.query?.only === 'string' && req.query.only) || null;
  const forceRun = req.query?.force === '1' || req.query?.force === 'true';

  // 1. Lista workflows ativos do Madureira
  let workflows: WorkflowRow[];
  if (onlyId) {
    workflows = await query<WorkflowRow>(
      `SELECT id, workspace_id, agent_id, name, schedule_cron, config
         FROM ai_workflows
        WHERE id = $1`,
      [onlyId],
    );
  } else {
    workflows = await query<WorkflowRow>(
      `SELECT id, workspace_id, agent_id, name, schedule_cron, config
         FROM ai_workflows
        WHERE is_active = true
          AND name LIKE 'madureira-%'`,
    );
  }

  // 2. Filtra os que devem disparar HOJE (a menos que force=1 ou only=<id>)
  const due = forceRun || onlyId
    ? workflows
    : workflows.filter((w) => isDueToday(w.schedule_cron, now));

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

  // 4. Idempotência: se já rodou hoje, skip (a menos que force=1)
  const skipNames: string[] = [];
  if (!forceRun) {
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
  }
  const todoWorkflows = due.filter((w) => !skipNames.includes(w.name));

  // 5. Executa workflows em paralelo (Lambda Vercel = 60s timeout, sequencial estourava
  //    com 4+ workflows × ~25s/Gemini-call cada). Gemini Flash aguenta 60 RPM no free
  //    tier, então 4 requests paralelas é seguro.
  async function runOne(w: WorkflowRow) {
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

      return {
        workflow: w.name,
        ok: out.ok,
        items: out.planningItemIds.length,
        violations: out.violations,
        error: out.error,
      };
    } catch (err: any) {
      console.error(`[madureira] workflow ${w.name} crashed:`, err?.message);
      if (runId) {
        await query(
          `UPDATE ai_workflow_runs SET status = 'crashed', error = $1, finished_at = now() WHERE id = $2`,
          [err?.message ?? 'unknown', runId],
        );
      }
      return { workflow: w.name, ok: false, error: err?.message };
    }
  }

  const results = await Promise.all(todoWorkflows.map(runOne));

  return res.status(200).json({
    ok: true,
    date: today,
    total_workflows: workflows.length,
    due_today: due.length,
    skipped_already_ran_today: skipNames,
    executed: results,
  });
}
