-- Corrigir avisos de segurança

-- 1. Corrigir search_path da função
DROP FUNCTION IF EXISTS public.cleanup_expired_oauth_attempts() CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_attempts()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_connection_attempts 
  WHERE expires_at < now() - interval '1 hour' AND used_at IS NULL;
  RETURN NEW;
END;
$$;

-- Recriar trigger
CREATE TRIGGER cleanup_oauth_attempts_trigger
  AFTER INSERT ON public.oauth_connection_attempts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_expired_oauth_attempts();

-- 2. Substituir política permissiva por uma mais restritiva (service role via RLS bypass, não precisa de policy)
DROP POLICY IF EXISTS "Service role full access" ON public.oauth_connection_attempts;