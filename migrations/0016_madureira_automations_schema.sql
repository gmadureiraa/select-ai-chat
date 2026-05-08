-- ─── Madureira Automations: schema + seed ─────────────────────────────────
-- Implementa MVP do spec em vault/01 - KALEIDOS/012 - INTERNO/02 - PROJETOS/KAI/
-- automation-madureira-redes/ (1792 LoC reduzidos a essencial executável).
--
-- Cria 3 tabelas + agent madureira-redes + 10 workflows seed.
-- Execução via handler `run-madureira-workflows-daily` (chamado pelo
-- cron-radar-master que já roda diariamente às 7h UTC).
--
-- IMPORTANTE: status='idea' sempre. Gabriel aprova manual no PlanningBoard.

-- ─── Tabelas ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  /** Skill principal (ex: copywriting-madureira@1.2). */
  skill_id text,
  /** Knowledge base refs: { docs: ['vault path 1', ...], notes: '...' }. */
  knowledge_base jsonb DEFAULT '{}'::jsonb,
  /** Sub-agents config: { hook_writer: {...}, body_writer: {...} }. */
  sub_agents jsonb DEFAULT '{}'::jsonb,
  /** Modelo padrão (ex: gemini-2.5-pro / gemini-2.5-flash). */
  model text DEFAULT 'gemini-2.5-flash',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ai_agents_workspace_name_unique UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_workspace ON public.ai_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON public.ai_agents(workspace_id, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.ai_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  /** Cron expression (ex: '0 6 * * 1' = seg 6h). Em UTC. */
  schedule_cron text NOT NULL,
  /**
   * Config arbitrário do workflow:
   * - client_id, format, platform, content_type
   * - prompt_template, due_date_offset_days, status_after_generation
   * - rotation_pillar (lista pra rodar a cada execução)
   */
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ai_workflows_workspace_name_unique UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ai_workflows_workspace ON public.ai_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_workflows_active ON public.ai_workflows(workspace_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_workflows_agent ON public.ai_workflows(agent_id);

CREATE TABLE IF NOT EXISTS public.ai_workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.ai_workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  /** Itens criados (planning_item ids). */
  output jsonb DEFAULT '[]'::jsonb,
  /** Violações de validator e tentativas de repair. */
  violations jsonb DEFAULT '[]'::jsonb,
  attempts int DEFAULT 1,
  error text,
  duration_ms int,
  cost_usd numeric(10, 6),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_workflow_runs_workflow ON public.ai_workflow_runs(workflow_id, started_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agents workspace read" ON public.ai_agents;
CREATE POLICY "ai_agents workspace read" ON public.ai_agents FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_agents workspace write" ON public.ai_agents;
CREATE POLICY "ai_agents workspace write" ON public.ai_agents FOR ALL TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
         OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
              OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_workflows workspace read" ON public.ai_workflows;
CREATE POLICY "ai_workflows workspace read" ON public.ai_workflows FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_workflows workspace write" ON public.ai_workflows;
CREATE POLICY "ai_workflows workspace write" ON public.ai_workflows FOR ALL TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
         OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
              OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_workflow_runs read" ON public.ai_workflow_runs;
CREATE POLICY "ai_workflow_runs read" ON public.ai_workflow_runs FOR SELECT TO authenticated
  USING (
    workflow_id IN (
      SELECT w.id FROM ai_workflows w
      WHERE w.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    ) OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

-- ─── Seed: agent madureira-redes ────────────────────────────────────────

INSERT INTO public.ai_agents (workspace_id, name, description, skill_id, knowledge_base, sub_agents, model)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid,
  'agent-madureira-redes',
  'Agente único pra gerar conteúdo do Gabriel Madureira (@ogmadureira) em IG, LinkedIn, X, Threads, TikTok. Aplica skill copywriting-madureira v1.2 + 12 frames proibidos do diagnóstico 2026-04-30.',
  'copywriting-madureira@1.2',
  jsonb_build_object(
    'docs', jsonb_build_array(
      'vault/99 - SISTEMA/claude-code/skills/copywriting-madureira/SKILL.md',
      'vault/99 - SISTEMA/claude-code/skills/copywriting-madureira/_DIAGNOSTICO-2026-04-30.md',
      'vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/CLAUDE.md',
      'vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/07-ESTRATEGIAS/PLANO-REDES-SOCIAIS-2026.md',
      'vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/07-ESTRATEGIAS/redes/instagram.md',
      'vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/07-ESTRATEGIAS/redes/linkedin.md',
      'vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/07-ESTRATEGIAS/redes/x-twitter.md',
      'vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/07-ESTRATEGIAS/redes/threads.md',
      'vault/01 - KALEIDOS/011 - CLIENTES/MADUREIRA/07-ESTRATEGIAS/redes/tiktok.md'
    ),
    'client_id', 'c3fdf44d-1eb5-49f0-aa91-a030642b5396',
    'pilares_mix', jsonb_build_object(
      'marketing', 0.70,
      'ia', 0.25,
      'cripto-contexto', 0.05
    ),
    'frames_proibidos', jsonb_build_array(
      'simplesmente', 'incrível', 'transformador', 'revolucionário', 'game-changer',
      'gurus', 'mindset', 'entregar valor', 'agregar valor', 'jornada', 'ecossistema',
      'quase ninguém', 'a escolha que custa caro',
      'você tá usando errado', 'você está fazendo errado', 'você precisa entender', 'você deveria',
      'hot take 🔥', 'unpopular opinion 🔥', 'here''s what i learned', 'if you''re a founder',
      'compartilhe com alguém', 'sua opinião nos comentários',
      'se você chegou até aqui', '🧵 thread', 'simples assim'
    ),
    'tecnicas_obrigatorias', jsonb_build_array(
      'hook-passa-3-testes', 'cena-kaleidos-real', 'tres-detalhes-especificos',
      'voz-ativa', 'ritmo-varia', 'primeira-pessoa', 'dado-numerico-no-1-ou-2-paragrafo',
      'pov-declarada', 'cta-organico'
    )
  ),
  jsonb_build_object(
    'hook_writer', jsonb_build_object('max_chars_x', 80, 'max_chars_ig_slide_cover', 150),
    'body_writer', jsonb_build_object('voz_ativa_min_pct', 90),
    'caption_writer', jsonb_build_object('hashtag_allowed', false, 'emoji_max', 1),
    'cta_writer', jsonb_build_object('proibido', '"comenta aí" / "salva isso" / "se você chegou até aqui"')
  ),
  'gemini-2.5-pro'
WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = '11111111-1111-1111-1111-111111111111')
  AND NOT EXISTS (
    SELECT 1 FROM ai_agents
    WHERE workspace_id = '11111111-1111-1111-1111-111111111111'
      AND name = 'agent-madureira-redes'
  );

-- ─── Seed: 10 workflows ─────────────────────────────────────────────────

INSERT INTO public.ai_workflows (workspace_id, agent_id, name, description, schedule_cron, config)
SELECT
  '11111111-1111-1111-1111-111111111111'::uuid,
  a.id,
  v.name,
  v.description,
  v.schedule_cron,
  v.config::jsonb
FROM public.ai_agents a,
(VALUES
  ('madureira-ig-carrossel-segunda',
   'Gera 1 carrossel IG na segunda — pilar marketing/strategy',
   '0 9 * * 1',  -- 6h BRT = 9h UTC
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_instagram_carousel","platform":"instagram","content_type":"instagram_post","pilar_dia":"marketing","capa_format":"F1","slides_min":8,"slides_max":12,"due_date_offset_days":1,"status_after_generation":"idea"}'),

  ('madureira-ig-reel-terca',
   'Gera 1 reel IG na terça — face_cam ou repurpose',
   '0 9 * * 2',
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_instagram_reel","platform":"instagram","content_type":"instagram_reel","tipo":"auto","duration_seconds":45,"caption_max_chars":500,"due_date_offset_days":1,"status_after_generation":"idea"}'),

  ('madureira-ig-carrossel-quarta',
   'Gera 1 carrossel IG na quarta — pilar IA/Claude Code',
   '0 9 * * 3',
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_instagram_carousel","platform":"instagram","content_type":"instagram_post","pilar_dia":"ia","capa_format":"F2","slides_min":8,"slides_max":12,"due_date_offset_days":1,"status_after_generation":"idea"}'),

  ('madureira-ig-reel-sexta',
   'Gera 1 reel IG na sexta — repurpose viral preferencial',
   '0 9 * * 5',
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_instagram_reel","platform":"instagram","content_type":"instagram_reel","tipo":"repurpose","duration_seconds":45,"due_date_offset_days":1,"status_after_generation":"idea"}'),

  ('madureira-ig-carrossel-sabado',
   'Gera 1 carrossel IG no sábado — pilar marketing heavy',
   '0 9 * * 6',
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_instagram_carousel","platform":"instagram","content_type":"instagram_post","pilar_dia":"marketing","capa_format":"alternar","slides_min":8,"slides_max":12,"due_date_offset_days":1,"status_after_generation":"idea"}'),

  ('madureira-linkedin-3x-semana',
   'Gera 1 post LI seg/qua/sex (rotacionando longo/curto/hot-take)',
   '0 10 * * 1,3,5',  -- 7h BRT = 10h UTC
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_linkedin_post","platform":"linkedin","content_type":"linkedin_post","first_line_max_chars":200,"hashtag_allowed":false,"due_date_offset_days":0,"status_after_generation":"idea","rotation_by_weekday":{"1":"longo","3":"curto","5":"hot-take"}}'),

  ('madureira-x-thread-2x-semana',
   'Gera 1 thread X seg/qui (12-18 tweets, PT-BR)',
   '0 11 * * 1,4',  -- 8h BRT = 11h UTC
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_x_thread","platform":"twitter","content_type":"thread","tweets_min":12,"tweets_max":18,"language":"pt-BR","due_date_offset_days":0,"status_after_generation":"idea","rotation_by_weekday":{"1":"deep-dive","4":"reactive"}}'),

  ('madureira-x-tweets-batch-diario',
   'Gera batch de 5 tweets X seg-sex (PT-BR)',
   '0 12 * * 1-5',  -- 9h BRT = 12h UTC
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_x_tweets_batch","platform":"twitter","content_type":"tweet","batch_size":5,"max_chars":280,"language":"pt-BR","due_date_offset_days":0,"status_after_generation":"idea"}'),

  ('madureira-threads-espelho-diario',
   'Espelha último carrossel IG/thread X aprovado em Threads',
   '0 13 * * *',  -- 10h BRT = 13h UTC, daily
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_threads_post","platform":"threads","content_type":"social_post","trigger":"after_approval","sources":["instagram_carousel","x_thread"],"posts_per_day":2,"due_date_offset_days":0,"status_after_generation":"idea"}'),

  ('madureira-tiktok-mensal-batch',
   'Gera batch de 4-6 roteiros TikTok dia 1 do mês',
   '0 12 1 * *',  -- 9h BRT = 12h UTC, dia 1
   '{"client_id":"c3fdf44d-1eb5-49f0-aa91-a030642b5396","format":"madureira_tiktok_video","platform":"tiktok","content_type":"short_video","batch_size":5,"duration_min":30,"duration_max":90,"caption_max_chars":300,"hashtags_min":5,"hashtags_max":8,"distribute_over":"month","status_after_generation":"idea"}')
) AS v(name, description, schedule_cron, config)
WHERE a.workspace_id = '11111111-1111-1111-1111-111111111111'
  AND a.name = 'agent-madureira-redes'
  AND NOT EXISTS (
    SELECT 1 FROM ai_workflows w
    WHERE w.workspace_id = '11111111-1111-1111-1111-111111111111'
      AND w.name = v.name
  );

-- Verificação inline
DO $$
DECLARE
  agent_count int;
  workflow_count int;
BEGIN
  SELECT count(*) INTO agent_count FROM ai_agents
    WHERE workspace_id = '11111111-1111-1111-1111-111111111111' AND name = 'agent-madureira-redes';
  SELECT count(*) INTO workflow_count FROM ai_workflows
    WHERE workspace_id = '11111111-1111-1111-1111-111111111111' AND name LIKE 'madureira-%';
  RAISE NOTICE '[0016] agent: % | workflows: %', agent_count, workflow_count;
END $$;
