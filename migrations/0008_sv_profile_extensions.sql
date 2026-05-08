-- Migration 0008: SV (Sequência Viral) profile extensions
--
-- O codigo viral-sv-original/ foi copiado literal do standalone Sequencia Viral.
-- O standalone esperava campos em `profiles` que NAO existem no schema KAI Neon:
--   - usage_count   (carrosseis usados no mes)
--   - usage_limit   (limite mensal por plano)
--   - sv_plan       ('free'|'starter'|'pro'|'enterprise') — namespaced pra
--                    nao colidir com qualquer coluna `plan` futura do KAI
--   - sv_period_start (inicio do ciclo de uso)
--   - referral_code (Programa Indique-e-Ganhe — captura ?ref= na landing)
--   - referred_by   (FK auto-referencial pra rastrear arvore de indicacao)
--
-- Idempotente: `IF NOT EXISTS` em colunas + indexes + funcao.
--
-- A funcao `increment_sv_usage` substitui o RPC `increment_usage_count`
-- chamado por `lib/carousel-storage.ts::bumpCarouselUsage`. Nome diferente
-- pra evitar choque com qualquer RPC pre-existente do KAI.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_limit integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sv_plan text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS sv_period_start timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);

-- CHECK constraint pra sv_plan — valida valores antes de aceitar.
-- Adicionado fora do ADD COLUMN porque ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS
-- nao existe pre-PG 18; usamos DO bloco pra detectar prevalencia.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_sv_plan_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_sv_plan_check
      CHECK (sv_plan IN ('free','starter','pro','enterprise'));
  END IF;
END $$;

-- UNIQUE em referral_code — DROP-and-CREATE estilo nao-quebra-se-ja-existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_referral_code_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);
  END IF;
END $$;

-- Index pra lookup rapido (WHERE referral_code = ...) — UNIQUE constraint
-- ja cria index, mas garantimos shape b-tree explicito caso alguem rode em
-- branch sem UNIQUE.
CREATE INDEX IF NOT EXISTS idx_profiles_referral
  ON public.profiles(referral_code)
  WHERE referral_code IS NOT NULL;

-- RPC pra bump atomico de usage_count. `SECURITY INVOKER` = roda com permissoes
-- do caller (nao bypassa RLS). Retorna o novo valor pra o cliente exibir
-- usage_count atualizado sem refetch.
CREATE OR REPLACE FUNCTION public.increment_sv_usage(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.profiles
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = p_user_id
  RETURNING usage_count;
$$;

-- Alias pra compat com o nome legacy chamado pelo carousel-storage.ts.
-- Mantem mesma assinatura (uid uuid → integer) pra que o RPC nao quebre.
CREATE OR REPLACE FUNCTION public.increment_usage_count(uid uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.profiles
  SET usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = uid
  RETURNING usage_count;
$$;
