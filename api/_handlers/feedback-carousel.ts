// Feedback de carrossel — chamado por viral-sv-original/components/app/FeedbackModal.tsx
// na tela de preview. No SV standalone gravava em DB próprio; aqui registra em
// sv_feedback_log (best-effort, falha silenciosa não bloqueia user).
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

export default authedPost(async ({ user, body }) => {
  const { carouselId, score, message, tags } = body ?? {};
  if (!carouselId) {
    throw new Error('carouselId is required');
  }
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO sv_feedback_log (user_id, carousel_id, score, message, tags, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [user.id, carouselId, typeof score === 'number' ? score : null, message ?? null, tags ?? null],
    );
  } catch (err) {
    // Tabela pode não existir em ambientes onde feedback não é coletado —
    // log mas não falha. User vê toast de sucesso mesmo assim.
    console.warn('[feedback-carousel] insert failed (non-fatal):', err);
  }
  return { ok: true };
});
