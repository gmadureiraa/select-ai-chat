// Cria/atualiza row em `profiles` pra um user autenticado via Neon Auth.
// Substitui o trigger `on_auth_user_created` que apontava pra `auth.users`
// (Supabase) e nunca dispara em Neon Auth.
//
// Front chama após signup OU sempre que detecta que `profiles` está faltando
// pro user atual (idempotente — ON CONFLICT DO NOTHING).
//
// Auth: JWT obrigatório.
// Body: { full_name?, avatar_url? } (opcional — pega de auth.email/raw)
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { getPool } from '../_lib/db.js';

const BodySchema = z.object({
  full_name: z.string().max(200).optional(),
  avatar_url: z.string().url().max(500).optional(),
});

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { full_name, avatar_url } = parsed.data;

  // Extrai dados do JWT/raw
  const raw = (user as any).raw ?? {};
  const email =
    (user as any).email ??
    raw.email ??
    null;
  const fullNameFromAuth =
    raw.user_metadata?.full_name ??
    raw.full_name ??
    raw.name ??
    null;
  const avatarFromAuth =
    raw.user_metadata?.avatar_url ??
    raw.avatar_url ??
    null;

  const pool = getPool();
  await pool.query(
    `INSERT INTO public.profiles (id, email, full_name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET email = COALESCE(EXCLUDED.email, profiles.email),
             full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
             updated_at = now()`,
    [
      user.id,
      email,
      full_name ?? fullNameFromAuth,
      avatar_url ?? avatarFromAuth,
    ],
  );

  // Idempotency: garante que user é membro do workspace 'kaleidos' (single-tenant).
  // Se já é membro, no-op. Se não é, vira viewer.
  await pool.query(
    `INSERT INTO public.workspace_members (workspace_id, user_id, role)
       SELECT w.id, $1, 'viewer'
         FROM public.workspaces w
        WHERE w.slug = 'kaleidos'
          AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
             WHERE wm.workspace_id = w.id AND wm.user_id = $1
          )`,
    [user.id],
  );

  return { ok: true, profile_synced: true };
});
