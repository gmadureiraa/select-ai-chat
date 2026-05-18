-- 0048_x_manual_reports.sql
-- Relatórios manuais do X/Twitter — usuário cola números do twitter.com/analytics
-- pq integrar a X API custaria caro. Cada relatório cobre um período (ex: 7d / 30d)
-- com números agregados + opcional snippets de top tweets.
--
-- Idempotente. RLS via assertClientAccess no handler (sem policies na tabela
-- porque o resto do KAI usa esse padrão — auth gate vive no handler).

CREATE TABLE IF NOT EXISTS public.client_x_manual_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  impressions     integer NOT NULL DEFAULT 0,
  engagements     integer NOT NULL DEFAULT 0,
  likes           integer NOT NULL DEFAULT 0,
  replies         integer NOT NULL DEFAULT 0,
  retweets        integer NOT NULL DEFAULT 0,
  bookmarks       integer NOT NULL DEFAULT 0,
  profile_visits  integer NOT NULL DEFAULT 0,
  new_followers   integer NOT NULL DEFAULT 0,
  notes           text,
  top_tweets      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_x_manual_reports_client_period
  ON public.client_x_manual_reports (client_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_x_manual_reports_client_created
  ON public.client_x_manual_reports (client_id, created_at DESC);

-- Trigger updated_at (segue mesmo pattern de 0024_post_transcriptions)
CREATE OR REPLACE FUNCTION public.set_updated_at_x_manual_reports()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_x_manual_reports_updated_at ON public.client_x_manual_reports;
CREATE TRIGGER trg_x_manual_reports_updated_at
  BEFORE UPDATE ON public.client_x_manual_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_x_manual_reports();
