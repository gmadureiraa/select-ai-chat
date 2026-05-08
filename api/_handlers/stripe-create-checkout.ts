// Stripe — Create Checkout Session
//
// POST { plan_id, billing_period: 'monthly' | 'yearly', workspace_id }
//
// Cria uma Checkout session no modo `subscription`. Retorna { url } pra
// o frontend redirecionar pro Stripe Checkout.
//
// Requisitos de env:
//   - STRIPE_SECRET_KEY               → chave secreta da conta Stripe
//   - STRIPE_PRICE_<PLAN>_<PERIOD>    → opcional, mapa de price IDs
//                                       ex: STRIPE_PRICE_STARTER_MONTHLY
//   - APP_URL                         → base URL pro success/cancel redirect
//
// Fallback defensivo: se STRIPE_SECRET_KEY ausente, retorna 503 — ainda não
// configurado em produção. Frontend precisa lidar com esse status.
//
// Stripe price ID pode vir de duas fontes (em ordem):
//   1. subscription_plans.stripe_price_id (única coluna no schema)
//   2. process.env.STRIPE_PRICE_<TYPE>_<PERIOD>
//
// Como o schema só tem 1 coluna `stripe_price_id` mas precisamos de 2 (mensal
// e anual), usamos as env vars como fonte canônica de verdade até Gabriel
// rodar o seed real dos products no Stripe.

import Stripe from 'stripe';
import { authedPost } from '../_lib/handler.js';
import { queryOne } from '../_lib/db.js';

interface PlanRow {
  id: string;
  type: 'free' | 'starter' | 'pro' | 'enterprise';
  name: string;
  stripe_price_id: string | null;
  price_monthly: string | number;
  price_yearly: string | number;
}

interface WorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
}

function resolvePriceId(planType: string, period: 'monthly' | 'yearly'): string | null {
  const key = `STRIPE_PRICE_${planType.toUpperCase()}_${period.toUpperCase()}`;
  return process.env[key] || null;
}

export default authedPost(async ({ user, body, res }) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    res.status(503).json({
      error: 'Stripe não configurado',
      hint: 'Falta STRIPE_SECRET_KEY — defina nas env vars do Vercel.',
    });
    return;
  }

  const { plan_id, billing_period, workspace_id } = body as {
    plan_id?: string;
    billing_period?: 'monthly' | 'yearly';
    workspace_id?: string;
  };

  if (!plan_id) throw new Error('plan_id é obrigatório');
  if (!workspace_id) throw new Error('workspace_id é obrigatório');
  if (billing_period !== 'monthly' && billing_period !== 'yearly') {
    throw new Error("billing_period deve ser 'monthly' ou 'yearly'");
  }

  // Verify workspace ownership — só owner pode iniciar checkout.
  const ws = await queryOne<WorkspaceRow>(
    `SELECT id, owner_id, name FROM workspaces WHERE id = $1`,
    [workspace_id],
  );
  if (!ws) throw new Error('Workspace não encontrado');
  if (ws.owner_id !== user.id) throw new Error('Apenas o owner pode contratar planos');

  // Buscar plan
  const plan = await queryOne<PlanRow>(
    `SELECT id, type, name, stripe_price_id, price_monthly, price_yearly
     FROM subscription_plans WHERE id = $1 AND is_active = true`,
    [plan_id],
  );
  if (!plan) throw new Error('Plano não encontrado ou inativo');
  if (plan.type === 'free') throw new Error('Plano Free não requer checkout');

  // Resolve price ID — env var tem prioridade sobre coluna (necessário pra suportar mensal+anual)
  const priceId =
    resolvePriceId(plan.type, billing_period) || plan.stripe_price_id;
  if (!priceId) {
    res.status(503).json({
      error: 'Price ID não configurado',
      hint: `Defina STRIPE_PRICE_${plan.type.toUpperCase()}_${billing_period.toUpperCase()} ou subscription_plans.stripe_price_id`,
    });
    return;
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-09-30.clover' as any });
  const appUrl =
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    'https://app.kaleidos.com.br';

  // Reuse customer se já existe pra esse workspace
  const existingSub = await queryOne<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM workspace_subscriptions WHERE workspace_id = $1`,
    [workspace_id],
  );

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: existingSub?.stripe_customer_id || undefined,
    customer_email: existingSub?.stripe_customer_id ? undefined : user.email,
    success_url: `${appUrl}/?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/?stripe=canceled`,
    metadata: {
      workspace_id,
      plan_id,
      plan_type: plan.type,
      billing_period,
      user_id: user.id,
    },
    subscription_data: {
      metadata: {
        workspace_id,
        plan_id,
        plan_type: plan.type,
        billing_period,
      },
    },
    allow_promotion_codes: true,
  });

  return { url: session.url, session_id: session.id };
});
