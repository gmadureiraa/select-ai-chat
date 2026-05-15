-- 0040_format_standards.sql
-- Fase 3 — Sistema de padronização de conteúdo (Camadas 1+2+3).
--
-- Contexto: Fase 1 criou 10 specs canônicos de FORMATO (agnósticos de cliente)
-- em `vault/99 - SISTEMA/format-standards/formats/*.md`. Fase 2 criou 36 specs
-- por (cliente × formato) em `vault/99 - SISTEMA/format-standards/clients/<cliente>/*.md`
-- pros 7 clientes ativos (madureira, defiverso, lucas-amendola, dsec, layla-foz,
-- hugo-doria, kaleidos-marca). Esta migration cria 2 tabelas que viram fonte
-- de verdade no KAI chat:
--
--   format_specs              — Camada 1 (10 rows, global, readable por todos)
--   client_format_standards   — Camada 2 (~36 rows, scoped por cliente via RLS)
--
-- Decisão sobre examples: mantemos como JSONB dentro de client_format_standards
-- (volume médio ≤ 5 examples_validated por spec, conforme audit dos 36 specs em
--  2026-05-15 — nenhum estoura > 10). Tabela separada `client_format_examples`
-- fica reservada pra Fase 4 (extração automática de top performers do Metricool).
--
-- Status check: aceita variantes que apareceram nos specs por causa dos 7
-- agentes geradores não terem unificado vocabulário. Normalização total fica
-- pra fase posterior — por ora aceitamos a união de valores reais.
--
-- Notes (bloqueadores documentais reportados pelos agentes da Fase 2, NÃO
-- bloqueiam essa Fase 3):
--   - Madureira: handle @madureira0x no SKILL.md linha 6 precisa virar @ogmadureira
--   - DSEC: skill copywriting-dsec v1.0 EN/PT inconsistente → migrar pra v1.1 PT-BR
--   - Lucas: examples_validated vazios em todos os 7 specs (1001 posts archive externos sem análise)
--   - Hugo: 02-CONTEUDO e 03-ROTEIROS vazias
--   - Kaleidos marca: 3 P0 abertos (brand voice / manifesto / política tom)
--   - ClickUp list "Conteúdo Kaleidos Marca" não existe (list_id NULL no spec)
--
-- RLS:
--   - format_specs: leitura global pra authenticated (todos workspaces leem os 10 formatos
--     canônicos); INSERT/UPDATE/DELETE só pra super_admins (curadoria centralizada).
--   - client_format_standards: scoped via clients.workspace_id (workspace members do client
--     conseguem ler/editar; outros não veem).
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS + CREATE POLICY.
-- Roda 2x sem efeito colateral.

-- =====================================================
-- format_specs (Camada 1 — 10 formatos canônicos globais)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.format_specs (
  format_id            text PRIMARY KEY,
  format_name          text NOT NULL,
  platform             text NOT NULL CHECK (platform IN (
                         'instagram','twitter','linkedin','email','blog','youtube'
                       )),
  content_type         text NOT NULL,
  canvas               jsonb NOT NULL DEFAULT '{}'::jsonb,
  length_unit          text NOT NULL CHECK (length_unit IN (
                         'slides','chars','tweets','words','minutes','seconds'
                       )),
  length_min           integer,
  length_max           integer,
  length_target        integer,
  default_kpi          text,
  secondary_kpis       text[]  DEFAULT '{}',
  cadence_typical      text,
  asset_pipeline       text,
  system_prompt_hints  text,
  body_markdown        text,
  schema_version       integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_format_specs_platform ON public.format_specs(platform);
CREATE INDEX IF NOT EXISTS idx_format_specs_content_type ON public.format_specs(content_type);

DROP TRIGGER IF EXISTS trg_format_specs_updated_at ON public.format_specs;
CREATE TRIGGER trg_format_specs_updated_at
  BEFORE UPDATE ON public.format_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.format_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "format_specs readable global" ON public.format_specs;
CREATE POLICY "format_specs readable global"
  ON public.format_specs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "format_specs insert super_admin" ON public.format_specs;
CREATE POLICY "format_specs insert super_admin"
  ON public.format_specs
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT count(*) FROM public.super_admins WHERE user_id = auth.uid()) > 0);

DROP POLICY IF EXISTS "format_specs update super_admin" ON public.format_specs;
CREATE POLICY "format_specs update super_admin"
  ON public.format_specs
  FOR UPDATE
  TO authenticated
  USING ((SELECT count(*) FROM public.super_admins WHERE user_id = auth.uid()) > 0)
  WITH CHECK ((SELECT count(*) FROM public.super_admins WHERE user_id = auth.uid()) > 0);

DROP POLICY IF EXISTS "format_specs delete super_admin" ON public.format_specs;
CREATE POLICY "format_specs delete super_admin"
  ON public.format_specs
  FOR DELETE
  TO authenticated
  USING ((SELECT count(*) FROM public.super_admins WHERE user_id = auth.uid()) > 0);

-- =====================================================
-- client_format_standards (Camada 2 — 36 rows, scoped por cliente)
-- =====================================================
-- Status: aceita variantes que apareceram nos 36 specs reais.
--   Camada 1 esperada: ativo | piloto | pausado | inativo
--   Variantes Kaleidos marca: ACTIVE-EMERGING | ACTIVE-PLANNED | ACTIVE | DORMANT
--   Variantes Hugo Doria:    ativo-leve | roadmap
--   Variantes Layla Foz:     ATIVO (uppercase)
-- Vamos aceitar a união sem case-sensitivity strict (lowercase tudo na CHECK).
CREATE TABLE IF NOT EXISTS public.client_format_standards (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  format_id                   text NOT NULL REFERENCES public.format_specs(format_id) ON DELETE RESTRICT,
  status                      text NOT NULL,
  cadence_actual              text,
  schedule_window             jsonb,
  renderer_template           text,
  voice_overrides             jsonb DEFAULT '{}'::jsonb,
  pillar_distribution         jsonb DEFAULT '{}'::jsonb,
  cta_template                jsonb DEFAULT '{}'::jsonb,
  kpi_overrides               jsonb DEFAULT '{}'::jsonb,
  disclaimers                 text[]  DEFAULT '{}',
  hard_constraints            jsonb DEFAULT '{}'::jsonb,
  examples_validated          jsonb DEFAULT '[]'::jsonb,
  examples_rejected           jsonb DEFAULT '[]'::jsonb,
  body_markdown               text,
  kai_chat_hard_constraints   text,
  kai_chat_soft_preferences   text,
  source_path                 text,
  last_reviewed               date,
  schema_version              integer NOT NULL DEFAULT 1,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_format UNIQUE (client_id, format_id),
  CONSTRAINT chk_status_lowercase CHECK (
    lower(status) IN (
      'ativo','piloto','pausado','inativo',
      'active','active-emerging','active-planned','dormant',
      'ativo-leve','roadmap'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_cfs_client ON public.client_format_standards(client_id);
CREATE INDEX IF NOT EXISTS idx_cfs_format ON public.client_format_standards(format_id);
CREATE INDEX IF NOT EXISTS idx_cfs_status ON public.client_format_standards(lower(status));

DROP TRIGGER IF EXISTS trg_cfs_updated_at ON public.client_format_standards;
CREATE TRIGGER trg_cfs_updated_at
  BEFORE UPDATE ON public.client_format_standards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_format_standards ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace members do client conseguem ler.
DROP POLICY IF EXISTS "cfs select workspace member" ON public.client_format_standards;
CREATE POLICY "cfs select workspace member"
  ON public.client_format_standards
  FOR SELECT
  TO authenticated
  USING (client_workspace_accessible(client_id, auth.uid()));

-- INSERT/UPDATE/DELETE: workspace members também (admins/editors do client).
-- Granularidade fina (read-only pra viewer) fica pra fase posterior.
DROP POLICY IF EXISTS "cfs insert workspace member" ON public.client_format_standards;
CREATE POLICY "cfs insert workspace member"
  ON public.client_format_standards
  FOR INSERT
  TO authenticated
  WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

DROP POLICY IF EXISTS "cfs update workspace member" ON public.client_format_standards;
CREATE POLICY "cfs update workspace member"
  ON public.client_format_standards
  FOR UPDATE
  TO authenticated
  USING (client_workspace_accessible(client_id, auth.uid()))
  WITH CHECK (client_workspace_accessible(client_id, auth.uid()));

DROP POLICY IF EXISTS "cfs delete workspace member" ON public.client_format_standards;
CREATE POLICY "cfs delete workspace member"
  ON public.client_format_standards
  FOR DELETE
  TO authenticated
  USING (client_workspace_accessible(client_id, auth.uid()));

-- =====================================================
-- VIEW conveniência: standards JOIN com formato canônico
-- =====================================================
-- Útil pro KAI chat puxar tudo num único SELECT.
CREATE OR REPLACE VIEW public.v_client_format_full AS
SELECT
  cfs.id                          AS standard_id,
  cfs.client_id,
  c.name                          AS client_name,
  c.workspace_id,
  cfs.format_id,
  fs.format_name,
  fs.platform,
  fs.content_type,
  fs.canvas,
  fs.length_unit,
  COALESCE(NULL::int, fs.length_min)    AS length_min,
  COALESCE(NULL::int, fs.length_max)    AS length_max,
  COALESCE(NULL::int, fs.length_target) AS length_target,
  fs.default_kpi,
  fs.secondary_kpis,
  fs.cadence_typical,
  fs.asset_pipeline,
  fs.system_prompt_hints,
  fs.body_markdown                AS format_body_markdown,
  cfs.status,
  cfs.cadence_actual,
  cfs.schedule_window,
  cfs.renderer_template,
  cfs.voice_overrides,
  cfs.pillar_distribution,
  cfs.cta_template,
  cfs.kpi_overrides,
  cfs.disclaimers,
  cfs.hard_constraints,
  cfs.examples_validated,
  cfs.examples_rejected,
  cfs.body_markdown               AS client_body_markdown,
  cfs.kai_chat_hard_constraints,
  cfs.kai_chat_soft_preferences,
  cfs.source_path,
  cfs.last_reviewed,
  cfs.schema_version,
  cfs.created_at,
  cfs.updated_at
FROM public.client_format_standards cfs
JOIN public.clients c       ON c.id = cfs.client_id
JOIN public.format_specs fs ON fs.format_id = cfs.format_id;

COMMENT ON TABLE  public.format_specs IS
  'Camada 1 do sistema de padronização de conteúdo. Spec canônico por formato (10 rows). Source: vault/99 - SISTEMA/format-standards/formats/*.md';

COMMENT ON TABLE  public.client_format_standards IS
  'Camada 2 do sistema de padronização de conteúdo. Override por (cliente × formato). Source: vault/99 - SISTEMA/format-standards/clients/<cliente>/*.md';

COMMENT ON VIEW   public.v_client_format_full IS
  'JOIN flat de client_format_standards + format_specs + clients. Usada pelo KAI chat (loadFormatStandard) pra montar system prompt em uma query só.';

NOTIFY pgrst, 'reload schema';
