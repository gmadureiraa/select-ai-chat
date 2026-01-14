-- Etapa 1: Corrigir FK do audit log para permitir desconectar
-- Remover constraint FK que impede delete

-- Primeiro, verificar se a tabela existe e remover a constraint
ALTER TABLE IF EXISTS public.social_credentials_audit_log 
  DROP CONSTRAINT IF EXISTS social_credentials_audit_log_credential_id_fkey;

-- Tornar credential_id nullable (para logs de delete onde a credencial não existe mais)
ALTER TABLE IF EXISTS public.social_credentials_audit_log 
  ALTER COLUMN credential_id DROP NOT NULL;

-- Etapa 2: Criar tabela para rastrear tentativas de conexão OAuth
CREATE TABLE IF NOT EXISTS public.oauth_connection_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  profile_id TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at TIMESTAMPTZ,
  error_message TEXT
);

-- Habilitar RLS
ALTER TABLE public.oauth_connection_attempts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own connection attempts"
  ON public.oauth_connection_attempts
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create connection attempts"
  ON public.oauth_connection_attempts
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own connection attempts"
  ON public.oauth_connection_attempts
  FOR UPDATE
  USING (created_by = auth.uid());

-- Service role pode fazer tudo (para o callback)
CREATE POLICY "Service role full access"
  ON public.oauth_connection_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_oauth_attempts_expires 
  ON public.oauth_connection_attempts(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_attempts_client_platform 
  ON public.oauth_connection_attempts(client_id, platform);

-- Limpar tentativas expiradas automaticamente (função + trigger opcional)
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_attempts()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.oauth_connection_attempts 
  WHERE expires_at < now() - interval '1 hour' AND used_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para limpar ao inserir novas tentativas
DROP TRIGGER IF EXISTS cleanup_oauth_attempts_trigger ON public.oauth_connection_attempts;
CREATE TRIGGER cleanup_oauth_attempts_trigger
  AFTER INSERT ON public.oauth_connection_attempts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_expired_oauth_attempts();