-- Remove o trigger órfão que tenta inserir na tabela de auditoria deletada
DROP TRIGGER IF EXISTS audit_social_credentials_trigger ON public.client_social_credentials;

-- Remove as funções órfãs que não têm mais utilidade
DROP FUNCTION IF EXISTS public.audit_credential_changes();
DROP FUNCTION IF EXISTS public.log_credential_access(UUID, UUID, TEXT, JSONB);