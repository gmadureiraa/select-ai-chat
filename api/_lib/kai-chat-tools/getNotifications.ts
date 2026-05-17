/**
 * Tool `getNotifications` — notificações não lidas (ou todas) do user.
 *
 * Lê `public.notifications` filtrado por `user_id = ctx.userId`. Tipos
 * conhecidos: assignment, due_date, mention, publish_reminder.
 *
 * Use quando o user perguntar "tenho notificação?", "o que tem de novo?",
 * "quem me mencionou?", "lista as not lidas", "alguém me atribuiu algo?".
 */
import type { RegisteredTool } from './types.js';
import { query } from '../db.js';

interface GetNotificationsArgs {
  workspace_id?: string;
  type?: 'assignment' | 'due_date' | 'mention' | 'publish_reminder' | 'all';
  unread_only?: boolean;
  limit?: number;
}

interface NotificationOut {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  workspaceId: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface GetNotificationsData {
  userId: string;
  notifications: NotificationOut[];
  count: number;
  unreadCount: number;
  filteredBy: {
    type: string;
    workspaceId: string | null;
    unreadOnly: boolean;
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const VALID_TYPES = new Set(['assignment', 'due_date', 'mention', 'publish_reminder']);

export const getNotificationsTool: RegisteredTool<
  GetNotificationsArgs,
  GetNotificationsData
> = {
  definition: {
    name: 'getNotifications',
    description:
      "Lista notificações do user logado (default: apenas não lidas, mais recentes primeiro). Tipos: assignment, due_date, mention, publish_reminder. Use quando o user perguntar 'tenho notificação?', 'o que tem de novo?', 'quem me mencionou?', 'algo pra mim?', 'lista not lidas'.",
    parameters: {
      type: 'object',
      properties: {
        workspace_id: {
          type: 'string',
          description: 'Filtra por workspace. Default: todos workspaces do user.',
        },
        type: {
          type: 'string',
          enum: ['assignment', 'due_date', 'mention', 'publish_reminder', 'all'],
          description: 'Filtra por tipo. Default: all.',
        },
        unread_only: {
          type: 'boolean',
          description: 'Se true (default), só não lidas. False = todas.',
        },
        limit: {
          type: 'integer',
          description: 'Máximo. Default 20, máx 100.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const rawLimit =
      typeof args.limit === 'number' && args.limit > 0
        ? Math.floor(args.limit)
        : DEFAULT_LIMIT;
    const limit = Math.min(rawLimit, MAX_LIMIT);
    const unreadOnly = args.unread_only !== false;
    const typeFilter =
      args.type && args.type !== 'all' && VALID_TYPES.has(args.type)
        ? args.type
        : null;
    const wsFilter = String(args.workspace_id ?? '').trim() || null;

    if (!ctx.userId) {
      return { ok: false, error: 'userId não disponível no contexto.' };
    }

    const where: string[] = ['user_id = $1'];
    const params: any[] = [ctx.userId];

    if (unreadOnly) {
      where.push(`read = false`);
    }
    if (typeFilter) {
      params.push(typeFilter);
      where.push(`type = $${params.length}`);
    }
    if (wsFilter) {
      params.push(wsFilter);
      where.push(`workspace_id = $${params.length}`);
    }

    params.push(limit);
    const limitIdx = params.length;

    try {
      const rows = await query<{
        id: string;
        type: string;
        title: string;
        message: string | null;
        entity_type: string | null;
        entity_id: string | null;
        workspace_id: string;
        read: boolean;
        read_at: string | null;
        created_at: string;
        metadata: unknown;
      }>(
        `SELECT id, type, title, message, entity_type, entity_id,
                workspace_id, read, read_at, created_at, metadata
           FROM notifications
          WHERE ${where.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${limitIdx}`,
        params,
      );

      const notifications: NotificationOut[] = rows.map((r) => ({
        id: String(r.id ?? ''),
        type: String(r.type ?? ''),
        title: String(r.title ?? ''),
        message: r.message ?? null,
        entityType: r.entity_type ?? null,
        entityId: r.entity_id ?? null,
        workspaceId: String(r.workspace_id ?? ''),
        read: !!r.read,
        readAt: r.read_at ?? null,
        createdAt: String(r.created_at ?? ''),
        metadata:
          r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
            ? (r.metadata as Record<string, unknown>)
            : null,
      }));

      const unreadCount = notifications.filter((n) => !n.read).length;

      console.log(
        `[getNotifications] user=${ctx.userId} unreadOnly=${unreadOnly} type=${typeFilter ?? 'all'} → ${notifications.length} (unread=${unreadCount})`,
      );

      return {
        ok: true,
        data: {
          userId: ctx.userId,
          notifications,
          count: notifications.length,
          unreadCount,
          filteredBy: {
            type: typeFilter ?? 'all',
            workspaceId: wsFilter,
            unreadOnly,
          },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[getNotifications] error:', err);
      return { ok: false, error: message };
    }
  },
};
