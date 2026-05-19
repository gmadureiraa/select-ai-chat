// Migrated from supabase/functions/import-clickup/index.ts
// ClickUp API token can come from env (CLICKUP_API_TOKEN) or per-request header (x-clickup-token).
// Defensive fallback: if no token at all, returns 503.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { verifyAuth } from '../_lib/auth.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { put } from '@vercel/blob';
import { assertClientAccess, assertWorkspaceAccess } from '../_lib/access.js';

const CLICKUP_API = 'https://api.clickup.com/api/v2';

interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: { status: string };
  priority: { id: string; priority: string } | null;
  due_date: string | null;
  start_date: string | null;
  tags: { name: string }[];
  attachments?: { id: string; url: string; title: string; extension: string }[];
  list?: { name: string };
  folder?: { name: string };
}

interface ClickUpAttachment {
  id?: string;
  url: string;
  title?: string;
  extension?: string;
}

interface ClickUpList {
  id: string;
  name: string;
}

interface ClickUpFolder {
  name: string;
  lists?: ClickUpList[];
}

interface ClickUpSpace {
  id: string;
  name: string;
}

interface ClickUpTeam {
  id: string;
  name: string;
}

interface ClickUpMapping {
  list_id: string;
  client_id: string;
  space_name: string;
  folder_name: string;
}

interface ImportClickUpBody {
  action?: string;
  workspace_id?: string;
  mappings?: ClickUpMapping[];
  since_date?: string;
  fetch_attachments?: boolean;
  limit?: number;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function errorStatus(error: unknown, fallback = 403): number {
  if (!isRecord(error)) return fallback;
  const status = error.statusCode ?? error.status;
  return typeof status === 'number' ? status : fallback;
}

function parseBody(raw: unknown): ImportClickUpBody {
  if (isRecord(raw)) return raw as ImportClickUpBody;
  if (typeof raw === 'string' && raw.trim()) return JSON.parse(raw) as ImportClickUpBody;
  return {};
}

async function clickupFetch<T = JsonRecord>(path: string, token: string): Promise<T> {
  const r = await fetch(`${CLICKUP_API}${path}`, { headers: { Authorization: token } });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`ClickUp API ${path} failed (${r.status}): ${text}`);
  }
  return await r.json() as T;
}

function inferPlatform(tags: string[], listName: string, folderName: string): string | null {
  const all = [...tags.map((t) => t.toLowerCase()), listName.toLowerCase(), folderName.toLowerCase()].join(
    ' '
  );
  if (all.includes('instagram') || all.includes('reels') || all.includes('carrossel') || all.includes('stories'))
    return 'instagram';
  if (all.includes('twitter') || all.includes('tweet') || all.includes('thread') || all.includes('x ') || all.includes('alfredp2p'))
    return 'twitter';
  if (all.includes('linkedin')) return 'linkedin';
  if (all.includes('tiktok')) return 'tiktok';
  if (all.includes('youtube')) return 'youtube';
  if (all.includes('newsletter') || all.includes('email')) return 'newsletter';
  if (all.includes('blog') || all.includes('news')) return 'blog';
  if (all.includes('facebook')) return 'facebook';
  if (all.includes('threads')) return 'threads';
  return null;
}

function inferContentType(tags: string[], listName: string): string | null {
  const all = [...tags.map((t) => t.toLowerCase()), listName.toLowerCase()].join(' ');
  if (all.includes('stories') || all.includes('story')) return 'stories';
  if (all.includes('reels') || all.includes('reel')) return 'reels';
  if (all.includes('carrossel') || all.includes('carousel')) return 'carousel';
  if (all.includes('twitter') || all.includes('tweet') || all.includes('alfredp2p')) return 'tweet';
  if (all.includes('linkedin')) return 'linkedin_post';
  if (all.includes('blog') || all.includes('news') || all.includes('artigo')) return 'blog_post';
  if (all.includes('newsletter') || all.includes('email marketing')) return 'newsletter';
  if (all.includes('feed') || all.includes('post') || all.includes('instagram')) return 'feed';
  if (all.includes('thread')) return 'thread';
  if (all.includes('vídeo') || all.includes('video') || all.includes('youtube') || all.includes('edição')) return 'video';
  if (all.includes('campanha') || all.includes('estratégia')) return 'strategy';
  return null;
}

function mapPriority(p: ClickUpTask['priority']): string {
  if (!p) return 'medium';
  switch (p.id) {
    case '1':
      return 'urgent';
    case '2':
      return 'high';
    case '3':
      return 'medium';
    case '4':
      return 'low';
    default:
      return 'medium';
  }
}

function mapStatusToColumnType(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('idea') || s.includes('ideia') || s.includes('backlog')) return 'idea';
  if (
    s.includes('rascunho') ||
    s.includes('draft') ||
    s.includes('em progresso') ||
    s.includes('in progress') ||
    s.includes('doing')
  )
    return 'draft';
  if (s.includes('revis') || s.includes('review')) return 'review';
  if (s.includes('aprov') || s.includes('approved') || s.includes('done') || s.includes('complete') || s.includes('conclu'))
    return 'approved';
  if (s.includes('agend') || s.includes('sched')) return 'scheduled';
  if (s.includes('publi')) return 'published';
  return 'idea';
}

async function uploadAttachmentToBlob(
  attachment: ClickUpAttachment,
  taskId: string,
  token: string
): Promise<string | null> {
  try {
    const r = await fetch(attachment.url, { headers: { Authorization: token } });
    if (!r.ok) return null;

    const buffer = Buffer.from(await r.arrayBuffer());
    const ext = attachment.extension || 'png';
    const fileName = `clickup/${taskId}/${Date.now()}_${attachment.title || 'file'}.${ext}`;
    const contentType = r.headers.get('content-type') || 'application/octet-stream';

    const blob = await put(fileName, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });
    return blob.url || null;
  } catch (err) {
    console.error(`Attachment upload failed: ${errorMessage(err)}`);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  // Token: prefer per-request header (user-provided), fall back to env
  const userToken =
    (req.headers['x-clickup-token'] as string | undefined) ||
    (req.headers['X-Clickup-Token'] as unknown as string | undefined);
  const CLICKUP_TOKEN = userToken || process.env.CLICKUP_API_TOKEN;

  if (!CLICKUP_TOKEN) {
    return res.status(503).json({
      error: 'ClickUp integration not configured',
      missing_env: ['CLICKUP_API_TOKEN'],
      hint: 'Either set CLICKUP_API_TOKEN env var in Vercel OR send x-clickup-token header per request',
    });
  }

  // Authenticate user
  let user;
  try {
    user = await verifyAuth(req);
  } catch (err) {
    return res.status(401).json({ error: errorMessage(err) || 'Authentication required' });
  }

  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    // action may come from query param OR body
    const queryAction = url.searchParams.get('action');
    const body = parseBody(req.body);
    const action = queryAction || body.action;

    const pool = getPool();

    // ─────── ACTION: discover ───────
    if (action === 'discover') {
      const teamsRes = await clickupFetch<{ teams?: ClickUpTeam[] }>('/team', CLICKUP_TOKEN);
      const teams = teamsRes.teams || [];

      const result: Array<{
        team_id: string;
        team_name: string;
        spaces: Array<{
          id: string;
          name: string;
          lists: Array<{ id: string; name: string; folder: string | null }>;
        }>;
      }> = [];
      for (const team of teams) {
        const spacesRes = await clickupFetch<{ spaces?: ClickUpSpace[] }>(
          `/team/${team.id}/space?archived=false`,
          CLICKUP_TOKEN
        );
        const spaces = spacesRes.spaces || [];
        const spaceData: Array<{
          id: string;
          name: string;
          lists: Array<{ id: string; name: string; folder: string | null }>;
        }> = [];

        for (const space of spaces) {
          const lists: Array<{ id: string; name: string; folder: string | null }> = [];
          const folderlessRes = await clickupFetch<{ lists?: ClickUpList[] }>(
            `/space/${space.id}/list?archived=false`,
            CLICKUP_TOKEN
          );
          for (const list of folderlessRes.lists || []) {
            lists.push({ id: list.id, name: list.name, folder: null });
          }
          const foldersRes = await clickupFetch<{ folders?: ClickUpFolder[] }>(
            `/space/${space.id}/folder?archived=false`,
            CLICKUP_TOKEN
          );
          for (const folder of foldersRes.folders || []) {
            for (const list of folder.lists || []) {
              lists.push({ id: list.id, name: list.name, folder: folder.name });
            }
          }
          spaceData.push({ id: space.id, name: space.name, lists });
        }
        result.push({ team_id: team.id, team_name: team.name, spaces: spaceData });
      }

      return res.status(200).json({ teams: result });
    }

    // ─────── ACTION: import ───────
    if (action === 'import') {
      const { workspace_id, mappings, since_date, fetch_attachments } = body;

      if (!workspace_id || !mappings?.length) {
        return res.status(400).json({ error: 'workspace_id and mappings required' });
      }

      // SEC 2026-05-18 audit P0: bloqueia cross-tenant write. Antes user
      // autenticado em workspace A podia POST { workspace_id: B } e injetar
      // planning_items + ler kanban_columns/planning_items existentes do B.
      try {
        await assertWorkspaceAccess(user.id, workspace_id);
        // Cada mapping aponta pra um client_id. Validar todos antes de bater na ClickUp.
        const uniqueClientIds = Array.from(
          new Set(
            (mappings as Array<{ client_id?: string }>)
              .map((m) => m.client_id)
              .filter((id): id is string => !!id)
          )
        );
        for (const cid of uniqueClientIds) {
          const { workspaceId: clientWorkspaceId } = await assertClientAccess(user.id, cid);
          if (clientWorkspaceId !== workspace_id) {
            return res.status(403).json({
              error: 'Cliente não pertence ao workspace alvo',
              client_id: cid,
            });
          }
        }
      } catch (err) {
        return res.status(errorStatus(err)).json({ error: errorMessage(err) || 'Acesso negado' });
      }

      const columns = await query<{ id: string; column_type: string | null }>(
        `SELECT id, column_type FROM kanban_columns WHERE workspace_id = $1`,
        [workspace_id]
      );
      const columnMap = new Map<string, string>();
      for (const col of columns) if (col.column_type) columnMap.set(col.column_type, col.id);

      const sinceTs = since_date
        ? new Date(since_date).getTime()
        : new Date('2026-04-01').getTime();

      let imported = 0;
      let skipped = 0;
      let attachmentsUploaded = 0;
      const errors: string[] = [];

      const existingItems = await query<{ metadata: unknown }>(
        `SELECT metadata FROM planning_items WHERE workspace_id = $1 AND metadata IS NOT NULL`,
        [workspace_id]
      );
      const existingTaskIds = new Set<string>();
      for (const item of existingItems) {
        const meta = isRecord(item.metadata) ? item.metadata : {};
        if (typeof meta.clickup_task_id === 'string') existingTaskIds.add(meta.clickup_task_id);
      }

      for (const mapping of mappings) {
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          try {
            const tasksRes = await clickupFetch<{ tasks?: ClickUpTask[] }>(
              `/list/${mapping.list_id}/task?archived=false&page=${page}&order_by=due_date&date_updated_gt=${sinceTs}&include_closed=true&subtasks=true`,
              CLICKUP_TOKEN
            );

            const tasks: ClickUpTask[] = tasksRes.tasks || [];
            if (tasks.length === 0) {
              hasMore = false;
              break;
            }

            for (const task of tasks) {
              try {
                if (existingTaskIds.has(task.id)) {
                  skipped++;
                  continue;
                }

                const tagNames = task.tags.map((t) => t.name);
                const listName = task.list?.name || '';
                const folderName = task.folder?.name || mapping.folder_name || '';
                const platform = inferPlatform(tagNames, listName, folderName);
                const contentType = inferContentType(tagNames, listName);
                const priority = mapPriority(task.priority);
                const statusColumnType = mapStatusToColumnType(task.status.status);
                const columnId = columnMap.get(statusColumnType) || columnMap.get('idea') || null;

                const mediaUrls: string[] = [];
                if (fetch_attachments) {
                  try {
                    const taskDetail = await clickupFetch<{ attachments?: ClickUpAttachment[] }>(`/task/${task.id}`, CLICKUP_TOKEN);
                    const attachments = taskDetail.attachments || [];
                    for (const att of attachments.slice(0, 5)) {
                      const publicUrl = await uploadAttachmentToBlob(att, task.id, CLICKUP_TOKEN);
                      if (publicUrl) {
                        mediaUrls.push(publicUrl);
                        attachmentsUploaded++;
                      }
                    }
                  } catch {
                    // continue without attachments
                  }
                }

                let scheduledAt: string | null = null;
                if (task.due_date) {
                  const d = new Date(parseInt(task.due_date));
                  if (!isNaN(d.getTime())) scheduledAt = d.toISOString();
                }

                try {
                  await pool.query(
                    `INSERT INTO planning_items
                      (workspace_id, client_id, title, content, platform, content_type, scheduled_at, status, priority, labels, media_urls, column_id, created_by, metadata)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
                    [
                      workspace_id,
                      mapping.client_id,
                      task.name,
                      task.description || null,
                      platform,
                      contentType,
                      scheduledAt,
                      statusColumnType === 'published' ? 'published' : 'idea',
                      priority,
                      tagNames,
                      mediaUrls,
                      columnId,
                      user.id,
                      JSON.stringify({
                        clickup_task_id: task.id,
                        clickup_list: listName,
                        clickup_folder: folderName,
                        clickup_space: mapping.space_name,
                        clickup_status: task.status.status,
                      }),
                    ]
                  );
                  imported++;
                  existingTaskIds.add(task.id);
                } catch (insertErr) {
                  errors.push(`Task "${task.name}": ${errorMessage(insertErr)}`);
                }
              } catch (err) {
                errors.push(`Task "${task.name}": ${errorMessage(err)}`);
              }
            }

            if (tasks.length < 100) hasMore = false;
            else page++;
          } catch (err) {
            errors.push(`List ${mapping.list_id}: ${errorMessage(err)}`);
            hasMore = false;
          }
        }
      }

      return res.status(200).json({
        imported,
        skipped,
        attachmentsUploaded,
        errors: errors.slice(0, 20),
      });
    }

    // ─────── ACTION: fetch-attachments ───────
    if (action === 'fetch-attachments') {
      const { workspace_id, limit = 20 } = body;

      if (!workspace_id) {
        return res.status(400).json({ error: 'workspace_id required' });
      }
      // SEC 2026-05-18 audit P0: idem import — fetch-attachments lia
      // planning_items.metadata e media_urls de qualquer workspace.
      try {
        await assertWorkspaceAccess(user.id, workspace_id);
      } catch (err) {
        return res.status(errorStatus(err)).json({ error: errorMessage(err) || 'Acesso negado' });
      }

      const items = await query<{ id: string; metadata: unknown; media_urls: unknown }>(
        `SELECT id, metadata, media_urls FROM planning_items
          WHERE workspace_id = $1 AND metadata IS NOT NULL LIMIT $2`,
        [workspace_id, limit]
      );

      const itemsToProcess = items.filter((item) => {
        const urls = item.media_urls;
        return !urls || (Array.isArray(urls) && urls.length === 0);
      });

      let updated = 0;
      const errors: string[] = [];

      for (const item of itemsToProcess) {
        const meta = isRecord(item.metadata) ? item.metadata : {};
        if (typeof meta.clickup_task_id !== 'string') continue;

        try {
          const taskDetail = await clickupFetch<{ attachments?: ClickUpAttachment[] }>(`/task/${meta.clickup_task_id}`, CLICKUP_TOKEN);
          const attachments = taskDetail.attachments || [];
          if (attachments.length === 0) continue;

          const mediaUrls: string[] = [];
          for (const att of attachments.slice(0, 5)) {
            const publicUrl = await uploadAttachmentToBlob(att, meta.clickup_task_id, CLICKUP_TOKEN);
            if (publicUrl) mediaUrls.push(publicUrl);
          }

          if (mediaUrls.length > 0) {
            await pool.query(`UPDATE planning_items SET media_urls = $1 WHERE id = $2 AND workspace_id = $3`, [
              mediaUrls,
              item.id,
              workspace_id,
            ]);
            updated++;
          }
        } catch (err) {
          errors.push(`Item ${item.id}: ${errorMessage(err)}`);
        }
      }

      return res.status(200).json({ updated, errors: errors.slice(0, 20) });
    }

    return res.status(400).json({
      error:
        'Unknown action. Use ?action=discover, ?action=import, or ?action=fetch-attachments',
    });
  } catch (err) {
    console.error('import-clickup error:', err);
    return res.status(500).json({ error: errorMessage(err) });
  }
}
