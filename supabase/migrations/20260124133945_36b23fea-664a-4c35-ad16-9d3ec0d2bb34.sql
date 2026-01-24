-- Atualizar planos para refletir nomes e limites corretos
UPDATE subscription_plans 
SET 
  name = 'Canvas',
  max_clients = 1,
  max_members = 1,
  features = '["canvas_ilimitado", "ia_multi_agente", "templates", "1_perfil", "geracao_imagens"]'::jsonb
WHERE type = 'starter';

UPDATE subscription_plans 
SET 
  name = 'Pro',
  max_clients = 10,
  max_members = 5,
  features = '["tudo_canvas", "planejamento_kanban", "performance_analytics", "biblioteca", "publicacao_automatica", "integrações", "calendario_editorial", "api_access"]'::jsonb
WHERE type = 'pro';