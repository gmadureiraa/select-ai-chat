-- Atualizar subscription_plans com preços e Stripe IDs corretos
-- Canvas ($19.90/mês) e Pro ($99.90/mês)

UPDATE subscription_plans 
SET 
  name = 'Canvas',
  price_monthly = 19.90,
  price_yearly = 199.00,
  max_clients = 1,
  max_members = 1,
  stripe_price_id = 'price_1SpuAmPIJtcImSMvb7h2pxYa',
  stripe_product_id = 'prod_TnVBYALwIy8qOm',
  features = '["canvas_ilimitado", "ia_multi_agente", "geracao_imagens", "templates", "1_perfil"]'::jsonb
WHERE type = 'starter';

UPDATE subscription_plans 
SET 
  name = 'Pro',
  price_monthly = 99.90,
  price_yearly = 999.00,
  max_clients = 10,
  max_members = 5,
  stripe_price_id = 'price_1SpuAoPIJtcImSMvLMPO5XUo',
  stripe_product_id = 'prod_TnVBIbisvWihL7',
  features = '["tudo_canvas", "3_perfis_base", "3_membros_base", "planning_kanban", "calendario", "performance_analytics", "biblioteca", "publicacao_automatica", "integracoes", "api"]'::jsonb
WHERE type = 'pro';