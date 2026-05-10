// Feedback de carrossel — chamado por viral-sv-original/components/app/FeedbackModal.tsx
// na tela de preview. No SV standalone gravava em DB próprio; aqui registra em
// sv_feedback_log (best-effort, falha silenciosa não bloqueia user).
//
// FeedbackModal envia { carouselId: string|null, rawText: string }. Aceitamos
// ambos os shapes (legado SV: rawText; novo: message + score + tags).
// carouselId pode ser null (se user abrir modal antes do save terminar).
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

export default authedPost(async ({ user, body }) => {
  const b = (body ?? {}) as Record<string, unknown>;
  const carouselId = (b.carouselId as string | null | undefined) ?? null;
  const rawText = (b.rawText as string | undefined) ?? null;
  const message = (b.message as string | undefined) ?? rawText ?? null;
  const score = typeof b.score === 'number' ? b.score : null;
  const tags = Array.isArray(b.tags) ? b.tags : null;
  // Validacao mínima: precisa ter ao menos texto OU score.
  if (!message && score === null) {
    const err = new Error('feedback_empty') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO sv_feedback_log (user_id, carousel_id, score, message, tags, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [user.id, carouselId, score, message, tags],
    );
  } catch (err) {
    // Tabela pode não existir em ambientes onde feedback não é coletado —
    // log mas não falha. User vê toast de sucesso mesmo assim.
    console.warn('[feedback-carousel] insert failed (non-fatal):', err);
  }
  return { ok: true };
});
