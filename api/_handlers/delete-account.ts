// Migrated from supabase/functions/delete-account/index.ts
// NOTE: Auth user deletion via Stack Auth API is not implemented here — only DB cleanup.
// The original Supabase implementation called supabase.auth.admin.deleteUser; under Neon Auth (Stack)
// the user/profile must be deleted via Stack Auth dashboard or their REST API. We delete the
// profiles row and all owned data; the actual auth identity will need to be removed manually
// or via a separate integration.
import { authedPost } from '../_lib/handler.js';
import { getPool, query } from '../_lib/db.js';

export default authedPost(async ({ user, body }) => {
  const { confirmEmail } = body;
  if (confirmEmail !== user.email) throw new Error('Email de confirmação não corresponde');

  const userId = user.id;
  const pool = getPool();

  // Cancel Stripe subscriptions if present
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && user.email) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/customers/search?query=${encodeURIComponent(`email:'${user.email}'`)}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const cd = await r.json();
      if (cd.data?.length) {
        const customerId = cd.data[0].id;
        const sr = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const sd = await sr.json();
        for (const sub of sd.data || []) {
          await fetch(`https://api.stripe.com/v1/subscriptions/${sub.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
        }
      }
    } catch (e) {
      console.warn('[delete-account] Stripe cleanup failed:', e);
    }
  }

  const userClients = await query<any>(`SELECT id FROM clients WHERE user_id = $1`, [userId]);
  const clientIds = userClients.map((c) => c.id);

  const clientTables = [
    'messages', 'conversations',
    'client_preferences', 'client_documents', 'client_websites', 'client_content_library',
    'client_reference_library', 'client_visual_references', 'client_social_credentials',
    'client_templates', 'instagram_tokens', 'instagram_posts', 'instagram_stories',
    'performance_goals', 'performance_reports', 'image_generations',
  ];

  if (clientIds.length > 0) {
    for (const t of clientTables) {
      try {
        await pool.query(`DELETE FROM ${t} WHERE client_id = ANY($1::uuid[])`, [clientIds]);
      } catch (e) {
        console.warn(`[delete-account] failed to delete from ${t}:`, e);
      }
    }
    try {
      await pool.query(`DELETE FROM clients WHERE user_id = $1`, [userId]);
    } catch (e) {
      console.warn('[delete-account] delete clients failed:', e);
    }
  }

  const userTables = [
    { table: 'favorite_messages', col: 'user_id' },
    { table: 'notifications', col: 'user_id' },
    { table: 'ai_usage_logs', col: 'user_id' },
    { table: 'workspace_members', col: 'user_id' },
    { table: 'profiles', col: 'id' },
  ];
  for (const { table, col } of userTables) {
    try {
      await pool.query(`DELETE FROM ${table} WHERE ${col} = $1`, [userId]);
    } catch (e) {
      console.warn(`[delete-account] failed to delete from ${table}:`, e);
    }
  }

  return { success: true, message: 'Dados do usuário excluídos. Remova a identidade de auth via Stack Auth se necessário.' };
});
