// Stripe — Webhook handler
//
// Recebe events da Stripe e sincroniza `workspace_subscriptions`,
// `workspace_tokens` e `token_transactions`.
//
// Eventos handled:
//   - checkout.session.completed       → cria/atualiza subscription + credita tokens
//   - customer.subscription.updated    → atualiza status, period, cancel_at_period_end
//   - customer.subscription.deleted    → marca status = 'canceled'
//
// Auth: HMAC via Stripe-Signature (verificado por stripe.webhooks.constructEvent).
// Não usa authedPost — endpoint público, autenticado via assinatura.
//
// Fallback defensivo: se STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausentes, 503.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, queryOne } from '../_lib/db.js';

async function readRawBody(req: VercelRequest): Promise<string> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return (req.body as Buffer).toString('utf-8');
    return JSON.stringify(req.body);
  }
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

interface PlanRow {
  id: string;
  type: string;
  tokens_monthly: number;
}

async function findPlanByStripeMetadata(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<PlanRow | null> {
  // 1. Try metadata.plan_id (set durante checkout)
  const metaPlanId = subscription.metadata?.plan_id;
  if (metaPlanId) {
    const plan = await queryOne<PlanRow>(
      `SELECT id, type, tokens_monthly FROM subscription_plans WHERE id = $1`,
      [metaPlanId],
    );
    if (plan) return plan;
  }

  // 2. Try metadata.plan_type
  const metaPlanType = subscription.metadata?.plan_type;
  if (metaPlanType) {
    const plan = await queryOne<PlanRow>(
      `SELECT id, type, tokens_monthly FROM subscription_plans WHERE type = $1::plan_type`,
      [metaPlanType],
    );
    if (plan) return plan;
  }

  // 3. Try subscription_plans.stripe_price_id (lookup pelo price)
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId) {
    const plan = await queryOne<PlanRow>(
      `SELECT id, type, tokens_monthly FROM subscription_plans WHERE stripe_price_id = $1`,
      [priceId],
    );
    if (plan) return plan;
  }

  return null;
}

function mapStripeStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case 'active':
    case 'trialing':
    case 'canceled':
    case 'past_due':
      return s;
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
    case 'paused':
      return 'past_due';
    default:
      return 'active';
  }
}

async function upsertSubscription(
  workspaceId: string,
  planId: string,
  subscription: Stripe.Subscription,
  tokensToCredit: number,
) {
  const pool = getPool();
  const status = mapStripeStatus(subscription.status);
  // current_period_start/end vivem no item, não na subscription, em versions recentes
  const item = subscription.items.data[0];
  const periodStart = new Date(((item as any)?.current_period_start ?? subscription.start_date) * 1000);
  const periodEnd = new Date(((item as any)?.current_period_end ?? subscription.start_date) * 1000);

  await pool.query(
    `INSERT INTO workspace_subscriptions
       (workspace_id, plan_id, status, current_period_start, current_period_end,
        cancel_at_period_end, stripe_subscription_id, stripe_customer_id, updated_at)
     VALUES ($1, $2, $3::subscription_status, $4, $5, $6, $7, $8, now())
     ON CONFLICT (workspace_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       updated_at = now()`,
    [
      workspaceId,
      planId,
      status,
      periodStart,
      periodEnd,
      !!subscription.cancel_at_period_end,
      subscription.id,
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    ],
  );

  if (tokensToCredit > 0) {
    // Resetar tokens (substitui balance, não acumula — política simples)
    await pool.query(
      `INSERT INTO workspace_tokens (workspace_id, balance, tokens_used_this_period, period_start, period_end, updated_at)
       VALUES ($1, $2, 0, $3, $4, now())
       ON CONFLICT (workspace_id) DO UPDATE SET
         balance = $2,
         tokens_used_this_period = 0,
         period_start = $3,
         period_end = $4,
         updated_at = now()`,
      [workspaceId, tokensToCredit, periodStart, periodEnd],
    );

    await pool.query(
      `INSERT INTO token_transactions
         (workspace_id, type, amount, balance_after, description, metadata)
       VALUES ($1, 'subscription_credit'::token_transaction_type, $2, $2, $3, $4::jsonb)`,
      [
        workspaceId,
        tokensToCredit,
        `Crédito mensal do plano (Stripe sub ${subscription.id})`,
        JSON.stringify({ stripe_subscription_id: subscription.id }),
      ],
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return jsonError(res, 503, 'Stripe não configurado', {
      missing: [
        ...(!stripeKey ? ['STRIPE_SECRET_KEY'] : []),
        ...(!webhookSecret ? ['STRIPE_WEBHOOK_SECRET'] : []),
      ],
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-09-30.clover' as any });
  const sigHeader = req.headers['stripe-signature'];
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  if (!signature) return jsonError(res, 400, 'Missing stripe-signature header');

  const rawBody = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return jsonError(res, 400, `Invalid signature: ${err.message}`);
  }

  console.log(`[stripe-webhook] received ${event.type} (id=${event.id})`);

  // IDEMPOTENCY: dedup por event.id. Stripe retenta webhooks em 5xx/timeout
  // (até 3 dias com exponential backoff). Sem isso, credit_tokens dobraria
  // em retry transient. Migration 0044 criou `stripe_webhook_events` (PK em id).
  // INSERT ON CONFLICT DO NOTHING — se event já processado, RETURNING vem
  // vazio e retornamos 200 OK (Stripe não retenta mais).
  const dedupStart = Date.now();
  try {
    const dedupRow = await queryOne<{ id: string }>(
      `INSERT INTO stripe_webhook_events (id, type, livemode, payload_summary)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        event.id,
        event.type,
        !!event.livemode,
        JSON.stringify({
          api_version: event.api_version,
          created: event.created,
        }),
      ],
    );
    if (!dedupRow) {
      console.log(`[stripe-webhook] duplicate event ${event.id} ignored (already processed)`);
      return res.status(200).json({ received: true, type: event.type, duplicate: true });
    }
  } catch (err: any) {
    // Se a tabela ainda não existe (migration 0044 não rodou), faz log e segue
    // — better than blocking webhooks. Re-rodar migration depois.
    if (err?.code === '42P01') {
      console.warn('[stripe-webhook] dedup table missing (migration 0044 not applied)');
    } else {
      console.error('[stripe-webhook] dedup insert error:', err);
      // Continua processando — não bloqueia event legítimo por falha de dedup.
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspace_id;
        if (!workspaceId) {
          console.warn('[stripe-webhook] checkout.session.completed sem workspace_id em metadata');
          break;
        }
        if (!session.subscription) {
          console.warn('[stripe-webhook] session sem subscription, pulando');
          break;
        }
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        const plan = await findPlanByStripeMetadata(stripe, subscription);
        if (!plan) {
          console.warn('[stripe-webhook] plano não encontrado pra sub', subId);
          break;
        }
        await upsertSubscription(workspaceId, plan.id, subscription, plan.tokens_monthly);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspace_id;
        if (!workspaceId) {
          // Fallback: localizar via stripe_subscription_id
          const existing = await queryOne<{ workspace_id: string }>(
            `SELECT workspace_id FROM workspace_subscriptions WHERE stripe_subscription_id = $1`,
            [sub.id],
          );
          if (!existing) {
            console.warn('[stripe-webhook] sub.updated sem workspace_id e sem registro existente');
            break;
          }
          const plan = await findPlanByStripeMetadata(stripe, sub);
          if (!plan) break;
          await upsertSubscription(existing.workspace_id, plan.id, sub, 0);
          break;
        }
        const plan = await findPlanByStripeMetadata(stripe, sub);
        if (!plan) break;
        // Plan trocado? Se sim, créditar novos tokens. Senão, só sincroniza status.
        const existing = await queryOne<{ plan_id: string }>(
          `SELECT plan_id FROM workspace_subscriptions WHERE workspace_id = $1`,
          [workspaceId],
        );
        const tokensToCredit = existing?.plan_id !== plan.id ? plan.tokens_monthly : 0;
        await upsertSubscription(workspaceId, plan.id, sub, tokensToCredit);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const pool = getPool();
        await pool.query(
          `UPDATE workspace_subscriptions
           SET status = 'canceled'::subscription_status,
               cancel_at_period_end = true,
               updated_at = now()
           WHERE stripe_subscription_id = $1`,
          [sub.id],
        );
        break;
      }

      default:
        console.log(`[stripe-webhook] event ${event.type} ignorado`);
    }
  } catch (err: any) {
    console.error('[stripe-webhook] handler error:', err);
    return jsonError(res, 500, err.message || 'Internal error');
  }

  // Marca duration no row de dedup (best-effort, não bloqueia resposta)
  const durationMs = Date.now() - dedupStart;
  getPool()
    .query(
      `UPDATE stripe_webhook_events SET duration_ms = $1 WHERE id = $2`,
      [durationMs, event.id],
    )
    .catch(() => null);

  res.status(200).json({ received: true, type: event.type });
}
