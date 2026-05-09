-- 0031_migration_tracking.sql
-- Cria tabela __migrations_applied pra tracking determinístico de migrations.
-- Antes desta, não havia source-of-truth no DB sobre quais migrations rodaram —
-- risco de drift entre disco e schema.
-- Aplicado em 2026-05-09 via script ad-hoc + backfill 0001-0030.

CREATE TABLE IF NOT EXISTS public.__migrations_applied (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT NOW(),
  sha256 text,
  notes text
);

COMMENT ON TABLE public.__migrations_applied IS
  'Tracking determinístico de migrations aplicadas. Auditável via SELECT * FROM __migrations_applied ORDER BY applied_at;';

-- Backfill será feito manualmente; código em scripts/track-migration.ts.
