// Tracking de indicação — chamado por viral-sv-original/lib/referral-client.ts
// após signup com código de indicação na URL.
//
// No SV standalone este handler aplica desconto via Stripe Coupon ao código
// referenciado. O KAI tem programa de indicação próprio (não implementado
// nesta branch) — endpoint mantido como NO-OP pra não quebrar referência
// legada do SV portado.
//
// TODO: implementar tracking real quando programa de indicação do KAI for
// definido (provavelmente envolvendo workspaces.invited_by + tabela
// referrals com Stripe Coupon).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  return res.status(200).json({ ok: true, noop: true, reason: 'KAI does not yet implement SV-style referrals' });
}
