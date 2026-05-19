// Email de boas-vindas — chamado fire-and-forget por
// viral-sv-original/lib/auth-context.tsx no signup.
//
// No SV standalone esse handler dispara um email via Resend. No KAI o fluxo
// de signup já tem onboarding próprio com convite/workspace, então este
// endpoint funciona como NO-OP pra não quebrar o void fetch() existente.
//
// TODO opcional: integrar com sistema de email transacional do KAI quando
// existir um fluxo de welcome unificado.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  // No-op silencioso — só pra evitar 404 em fire-and-forget legado.
  return res.status(200).json({ ok: true, noop: true });
}
