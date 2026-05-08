// Postiz schedule handler — alias semântico de postiz-post forçando publishNow=false.
//
// Aceita o mesmo payload de postiz-post, mas exige `scheduledFor`.
// Mantido como handler separado por paridade com a estrutura legada Late
// (onde `late-post` era usado pra ambos com flag, e o front pode preferir endpoint dedicado).
import { authedPost } from '../_lib/handler.js';
import postizPostHandler from './postiz-post.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default authedPost(async ({ body, req, res }) => {
  if (!body?.scheduledFor) {
    throw new Error('scheduledFor é obrigatório para agendamento');
  }
  const augmented = { ...body, publishNow: false };

  // Delega pro postiz-post handler in-process via mock req/res.
  let payload: any = null;
  let status = 200;
  const mockRes = {
    statusCode: 200,
    writableEnded: false,
    setHeader: () => {},
    status(code: number) {
      this.statusCode = code;
      status = code;
      return this;
    },
    json(p: any) {
      payload = p;
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
  } as unknown as VercelResponse;

  const mockReq = {
    method: 'POST',
    headers: req.headers,
    body: augmented,
    query: {},
  } as unknown as VercelRequest;

  await (postizPostHandler as any)(mockReq, mockRes);

  if (status >= 400) {
    throw new Error(payload?.error || `postiz-post falhou (${status})`);
  }
  return payload;
});
