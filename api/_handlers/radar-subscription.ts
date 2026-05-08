// GET /api/radar-subscription — info da subscription do user logado.
// Anônimo → free.
//
// KAI usa workspace_subscriptions (workspace-scoped). Estratégia: pega o
// melhor plano ativo entre workspaces que o user possui (owner_id).
// Ported de radar-viral/app/api/me/subscription/route.ts (com adaptação).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, handlePreflight } from "../_lib/cors.js";
import { tryAuth } from "../_lib/auth.js";
import { queryOne } from "../_lib/db.js";

interface SubRow {
  plan_type: string | null;
  status: string;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const FREE_RESPONSE = {
  plan: "free" as const,
  status: "active",
  isPaid: false,
  hasStripeCustomer: false,
  currentPeriodEnd: null as string | null,
  cancelAtPeriodEnd: false,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await tryAuth(req);
  if (!user) {
    return res.status(200).json(FREE_RESPONSE);
  }

  try {
    // Pega a subscription "melhor" do user — workspace que ele é owner
    // com plano pago (não-free) e status ativo. Se nenhuma, retorna free.
    const sub = await queryOne<SubRow>(
      `SELECT sp.type AS plan_type, ws.status::text AS status,
              ws.stripe_customer_id, ws.current_period_end::text,
              ws.cancel_at_period_end
         FROM workspaces w
         JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
         JOIN subscription_plans sp ON sp.id = ws.plan_id
        WHERE w.owner_id = $1
          AND ws.status::text = 'active'
        ORDER BY CASE sp.type::text
                   WHEN 'enterprise' THEN 1
                   WHEN 'pro' THEN 2
                   WHEN 'starter' THEN 3
                   WHEN 'free' THEN 4
                   ELSE 5
                 END ASC,
                 ws.current_period_end DESC NULLS LAST
        LIMIT 1`,
      [user.id],
    );

    if (!sub) {
      return res.status(200).json(FREE_RESPONSE);
    }

    const plan = (sub.plan_type ?? "free").toLowerCase();
    const isPaid = plan !== "free" && sub.status === "active";

    return res.status(200).json({
      plan,
      status: sub.status,
      isPaid,
      hasStripeCustomer: Boolean(sub.stripe_customer_id),
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
  } catch (err) {
    console.error("[radar-subscription] failed:", err);
    return res.status(200).json(FREE_RESPONSE);
  }
}
