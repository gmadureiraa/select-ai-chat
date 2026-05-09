-- 0024_post_transcriptions.sql
-- Sistema de transcrição automática de posts (caption + visual + carousel + reel + story)
-- via Gemini 2.5 Flash com Vision. Pega posts puxados do Metricool, Instagram scraper ou
-- planning_items e gera descrições detalhadas pra contextualizar em quaisquer agentes.
--
-- Idempotente: roda múltiplas vezes sem efeito colateral.

CREATE TABLE IF NOT EXISTS public.client_post_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  post_id text NOT NULL,
  source text NOT NULL,
  network text NOT NULL,
  post_type text,
  caption text,
  visual_description text,
  carousel_slides jsonb,
  reel_audio_transcript text,
  reel_scenes jsonb,
  story_description text,
  full_summary text,
  language text DEFAULT 'pt-BR',
  model text DEFAULT 'gemini-2.5-flash',
  tokens_used integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT client_post_transcriptions_unique UNIQUE (client_id, post_id, source)
);

CREATE INDEX IF NOT EXISTS idx_post_transcriptions_client_network
  ON public.client_post_transcriptions (client_id, network);

CREATE INDEX IF NOT EXISTS idx_post_transcriptions_post_id
  ON public.client_post_transcriptions (post_id);

CREATE INDEX IF NOT EXISTS idx_post_transcriptions_client_created
  ON public.client_post_transcriptions (client_id, created_at DESC);

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_post_transcriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_post_transcriptions_updated_at
    BEFORE UPDATE ON public.client_post_transcriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- update_updated_at_column nao existe nesse Neon; segue sem trigger
  RAISE NOTICE 'update_updated_at_column ausente; pulei trigger';
END $$;

-- RLS — workspace members podem ler/escrever transcrições do cliente
ALTER TABLE public.client_post_transcriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Workspace members can view post transcriptions'
      AND tablename = 'client_post_transcriptions'
  ) THEN
    CREATE POLICY "Workspace members can view post transcriptions"
      ON public.client_post_transcriptions FOR SELECT
      USING (client_workspace_accessible(client_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Workspace members can insert post transcriptions'
      AND tablename = 'client_post_transcriptions'
  ) THEN
    CREATE POLICY "Workspace members can insert post transcriptions"
      ON public.client_post_transcriptions FOR INSERT
      WITH CHECK (client_workspace_accessible(client_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Workspace members can update post transcriptions'
      AND tablename = 'client_post_transcriptions'
  ) THEN
    CREATE POLICY "Workspace members can update post transcriptions"
      ON public.client_post_transcriptions FOR UPDATE
      USING (client_workspace_accessible(client_id, auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Workspace members can delete post transcriptions'
      AND tablename = 'client_post_transcriptions'
  ) THEN
    CREATE POLICY "Workspace members can delete post transcriptions"
      ON public.client_post_transcriptions FOR DELETE
      USING (client_workspace_can_delete(client_id, auth.uid()));
  END IF;
EXCEPTION WHEN undefined_function THEN
  -- Helpers RLS não existem; sem RLS por enquanto (Neon Data API gerencia)
  RAISE NOTICE 'helpers de workspace RLS ausentes; políticas não criadas';
END $$;

COMMENT ON TABLE public.client_post_transcriptions IS
  'Transcrições e descrições detalhadas de posts (texto, imagem, carrossel slide-a-slide, reel cenas, story). Geradas via Gemini 2.5 Flash Vision/Audio. UNIQUE (client_id, post_id, source) — idempotente.';

COMMENT ON COLUMN public.client_post_transcriptions.source IS
  'Origem do post: metricool | instagram_posts | planning';
COMMENT ON COLUMN public.client_post_transcriptions.network IS
  'Rede social: instagram | facebook | twitter | linkedin | tiktok | youtube | threads';
COMMENT ON COLUMN public.client_post_transcriptions.post_type IS
  'Tipo do post: post | carousel | reel | story | video';
COMMENT ON COLUMN public.client_post_transcriptions.carousel_slides IS
  'jsonb array [{ index, image_url, description }]';
COMMENT ON COLUMN public.client_post_transcriptions.reel_scenes IS
  'jsonb array [{ start_sec, end_sec, description }]';
