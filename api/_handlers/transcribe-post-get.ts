// transcribe-post-get — busca transcrições existentes (read-only).
//
// Body: {
//   clientId: string;            // obrigatório
//   postId?: string;             // se passado, retorna 1 transcrição específica
//   postIds?: string[];          // bulk: até 100
//   source?: 'metricool' | 'instagram_posts' | 'planning';
//   network?: string;
// }
//
// Retorna: { transcriptions: TranscriptionRow[], total: number }
import { authedPost } from '../_lib/handler.js';
import { query } from '../_lib/db.js';

interface GetBody {
  clientId?: string;
  postId?: string;
  postIds?: string[];
  source?: string;
  network?: string;
  limit?: number;
}

export default authedPost(async ({ body }) => {
  const {
    clientId,
    postId,
    postIds,
    source,
    network,
    limit = 100,
  } = (body || {}) as GetBody;

  if (!clientId) throw new Error('clientId é obrigatório');

  const ids = postId ? [postId] : Array.isArray(postIds) ? postIds : null;

  const params: any[] = [clientId];
  let sql = `SELECT * FROM client_post_transcriptions WHERE client_id = $1`;

  if (ids && ids.length > 0) {
    params.push(ids);
    sql += ` AND post_id = ANY($${params.length})`;
  }
  if (source) {
    params.push(source);
    sql += ` AND source = $${params.length}`;
  }
  if (network) {
    params.push(network);
    sql += ` AND network = $${params.length}`;
  }

  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
  sql += ` ORDER BY updated_at DESC LIMIT $${params.length}`;

  const rows = await query(sql, params);

  return {
    transcriptions: rows,
    total: rows.length,
  };
});
