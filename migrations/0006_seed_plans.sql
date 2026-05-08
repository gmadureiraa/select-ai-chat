-- Migration 0006: Seed/refresh subscription_plans com 4 tiers (Free/Starter/Pro/Enterprise)
--
-- Idempotente: ON CONFLICT (type) DO UPDATE atualiza nome, preços, limites e features
-- caso o plano já exista. Plans são identificados pelo enum `plan_type`.
--
-- Schema alvo (já criado em 20251224022611):
--   subscription_plans (id, name, type, price_monthly, price_yearly,
--                       tokens_monthly, max_clients, max_members, features,
--                       is_active, created_at)
--
-- Pricing em BRL:
--   Free:        R$    0 / R$       0 -      100 tokens
--   Starter:     R$   97 / R$     873 -    1.000 tokens (yearly = 9 meses)
--   Pro:         R$  297 / R$   2.673 -    5.000 tokens
--   Enterprise:  R$  997 / R$   8.973 -   25.000 tokens
--
-- features JSONB: object com flags por feature, não array. Existing seed na 0001
-- usa array — esta migration força o object pra refletir limits estruturados.

INSERT INTO public.subscription_plans (
    name, type, price_monthly, price_yearly,
    tokens_monthly, max_clients, max_members, features, is_active
) VALUES
  (
    'Free', 'free', 0, 0,
    100, 1, 1,
    '{"viral_carousel":false,"viral_reels":false,"viral_radar":false,"sla":false}'::jsonb,
    true
  ),
  (
    'Starter', 'starter', 97, 873,
    1000, 3, 2,
    '{"viral_carousel":true,"viral_reels":true,"viral_radar":false,"sla":false}'::jsonb,
    true
  ),
  (
    'Pro', 'pro', 297, 2673,
    5000, 10, 5,
    '{"viral_carousel":true,"viral_reels":true,"viral_radar":true,"sla":false}'::jsonb,
    true
  ),
  (
    'Enterprise', 'enterprise', 997, 8973,
    25000, -1, -1,
    '{"viral_carousel":true,"viral_reels":true,"viral_radar":true,"sla":true}'::jsonb,
    true
  )
ON CONFLICT (type) DO UPDATE SET
  name           = EXCLUDED.name,
  price_monthly  = EXCLUDED.price_monthly,
  price_yearly   = EXCLUDED.price_yearly,
  tokens_monthly = EXCLUDED.tokens_monthly,
  max_clients    = EXCLUDED.max_clients,
  max_members    = EXCLUDED.max_members,
  features       = EXCLUDED.features,
  is_active      = EXCLUDED.is_active;
