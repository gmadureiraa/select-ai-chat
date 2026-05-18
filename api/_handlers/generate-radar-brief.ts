// STUB — handler placeholder pra dev-test-flows e referências externas.
// TODO: implementar de verdade ou remover a referência.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);
  return jsonError(res, 501, 'generate-radar-brief não implementado (stub)');
}
