// Stripe — Customer Portal session
//
// POST { workspace_id }
//
// Retorna URL de redirect pro Stripe Customer Portal, onde o user gerencia
// método de pagamento, troca de plano e cancela subscription.
//
// Requer:
//   - STRIPE_SECRET_KEY
//   - workspace tem stripe_customer_id em workspace_subscriptions
//   - APP_URL pra return_url (default app.kaleidos.com.br)
//
// Permissão: apenas owner do workspace.

import Stripe from 'stripe';
import { authedPost } from '../_lib/handler.js';
import { queryOne } from '../_lib/db.js';

interface SubRow {
  stripe_customer_id: string | null;
}

interface WorkspaceRow {
  owner_id: string;
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

  const { workspace_id } = body as { workspace_id?: string };
  if (!workspace_id) throw new Error('workspace_id é obrigatório');

  const ws = await queryOne<WorkspaceRow>(
    `SELECT owner_id FROM workspaces WHERE id = $1`,
    [workspace_id],
  );
  if (!ws) throw new Error('Workspace não encontrado');
  if (ws.owner_id !== user.id) throw new Error('Apenas o owner pode acessar o portal de cobrança');

  const sub = await queryOne<SubRow>(
    `SELECT stripe_customer_id FROM workspace_subscriptions WHERE workspace_id = $1`,
    [workspace_id],
  );
  if (!sub?.stripe_customer_id) {
    res.status(400).json({
      error: 'Workspace ainda não tem subscription ativa',
      hint: 'Use stripe-create-checkout pra contratar um plano primeiro.',
    });
    return;
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-09-30.clover' as any });
  const appUrl =
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    'https://app.kaleidos.com.br';

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/?tab=billing`,
  });

  return { url: session.url };
});
