-- Desabilitar trigger de auditoria temporariamente
ALTER TABLE public.client_social_credentials DISABLE TRIGGER audit_social_credentials_trigger;

-- Primeiro deletar registros de auditoria relacionados
DELETE FROM public.social_credentials_audit_log 
WHERE credential_id IN (
  SELECT id FROM public.client_social_credentials 
  WHERE platform IN ('late_profile', 'twitter', 'instagram', 'linkedin', 'facebook', 'threads', 'tiktok', 'youtube')
);

-- Agora deletar os registros de credenciais
DELETE FROM public.client_social_credentials 
WHERE platform = 'late_profile';

DELETE FROM public.client_social_credentials 
WHERE platform IN ('twitter', 'instagram', 'linkedin', 'facebook', 'threads', 'tiktok', 'youtube');

-- Reabilitar trigger de auditoria
ALTER TABLE public.client_social_credentials ENABLE TRIGGER audit_social_credentials_trigger;