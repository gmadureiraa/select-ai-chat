-- Desabilitar trigger de auditoria temporariamente
ALTER TABLE public.client_social_credentials DISABLE TRIGGER audit_social_credentials_trigger;

-- Limpar late_profile existentes para forçar recriação com mapeamento correto 1:1
DELETE FROM public.client_social_credentials 
WHERE platform = 'late_profile';

-- Limpar credenciais de plataforma que podem estar com late_profile_id incorreto
DELETE FROM public.client_social_credentials 
WHERE platform IN ('twitter', 'instagram', 'linkedin', 'facebook', 'threads', 'tiktok', 'youtube')
  AND metadata IS NOT NULL 
  AND metadata->>'late_profile_id' IS NOT NULL;

-- Reabilitar trigger de auditoria
ALTER TABLE public.client_social_credentials ENABLE TRIGGER audit_social_credentials_trigger;