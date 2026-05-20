// Lista comentários de um planning_item com profile, sem depender de embedded
// joins do PostgREST/Data API. Auth: user precisa acessar o workspace do item.
import { z } from 'zod';
import { authedPost } from '../_lib/handler.js';
import { query, queryOne } from '../_lib/db.js';

const BodySchema = z.object({
  planning_item_id: z.string().uuid(),
});

type CommentRow = {
  id: string;
  planning_item_id: string;
  user_id: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
  profile_full_name: string | null;
  profile_avatar_url: string | null;
  profile_email: string | null;
};

export default authedPost(async ({ body, user }) => {
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { planning_item_id } = parsed.data;

  const access = await queryOne<{ workspace_id: string }>(
    `SELECT pi.workspace_id
       FROM planning_items pi
       LEFT JOIN workspace_members wm
         ON wm.workspace_id = pi.workspace_id AND wm.user_id = $2
      WHERE pi.id = $1
        AND (
          wm.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM super_admins WHERE user_id = $2)
        )
      LIMIT 1`,
    [planning_item_id, user.id],
  );
  if (!access?.workspace_id) {
    throw new Error('Planning item não encontrado ou acesso negado');
  }

  const rows = await query<CommentRow>(
    `SELECT c.id, c.planning_item_id, c.user_id, c.content,
            c.created_at, c.updated_at,
            p.full_name AS profile_full_name,
            p.avatar_url AS profile_avatar_url,
            p.email AS profile_email
       FROM planning_item_comments c
       LEFT JOIN profiles p ON p.id = c.user_id
      WHERE c.planning_item_id = $1
      ORDER BY c.created_at ASC, c.id ASC`,
    [planning_item_id],
  );

  return {
    ok: true,
    comments: rows.map((row) => ({
      id: row.id,
      planning_item_id: row.planning_item_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      profile: {
        full_name: row.profile_full_name,
        avatar_url: row.profile_avatar_url,
        email: row.profile_email,
      },
    })),
  };
});
