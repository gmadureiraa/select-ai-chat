// Migrated from supabase/functions/import-clickup/index.ts
// ClickUp API token can come from env (CLICKUP_API_TOKEN) or per-request header (x-clickup-token).
// Defensive fallback: if no token at all, returns 503.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight } from '../_lib/cors.js';
import { verifyAuth } from '../_lib/auth.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { put } from '@vercel/blob';

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

async function clickupFetch(path: string, token: string) {
  const r = await fetch(`${CLICKUP_API}${path}`, { headers: { Authorization: token } });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`ClickUp API ${path} failed (${r.status}): ${text}`);
  }
  return r.json();
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
  attachment: { url: string; title: string; extension: string },
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
  } catch (e: any) {
    console.error(`Attachment upload failed: ${e.message}`);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);

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
  } catch (e: any) {
    return res.status(401).json({ error: e.message || 'Authentication required' });
  }

  try {
    const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
    // action may come from query param OR body
    const queryAction = url.searchParams.get('action');
    const body =
      req.body && typeof req.body === 'object'
        ? req.body
        : req.body
          ? JSON.parse(req.body)
          : {};
    const action = queryAction || body.action;

    const pool = getPool();

    // ─────── ACTION: discover ───────
    if (action === 'discover') {
      const teamsRes = await clickupFetch('/team', CLICKUP_TOKEN);
      const teams = teamsRes.teams || [];

      const result: any[] = [];
      for (const team of teams) {
        const spacesRes = await clickupFetch(
          `/team/${team.id}/space?archived=false`,
          CLICKUP_TOKEN
        );
        const spaces = spacesRes.spaces || [];
        const spaceData: any[] = [];

        for (const space of spaces) {
          const lists: any[] = [];
          const folderlessRes = await clickupFetch(
            `/space/${space.id}/list?archived=false`,
            CLICKUP_TOKEN
          );
          for (const list of folderlessRes.lists || []) {
            lists.push({ id: list.id, name: list.name, folder: null });
          }
          const foldersRes = await clickupFetch(
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

      const columns = await query<any>(
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

      const existingItems = await query<any>(
        `SELECT metadata FROM planning_items WHERE workspace_id = $1 AND metadata IS NOT NULL`,
        [workspace_id]
      );
      const existingTaskIds = new Set<string>();
      for (const item of existingItems) {
        const meta = item.metadata as any;
        if (meta?.clickup_task_id) existingTaskIds.add(meta.clickup_task_id);
      }

      for (const mapping of mappings as Array<{
        list_id: string;
        client_id: string;
        space_name: string;
        folder_name: string;
      }>) {
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          try {
            const tasksRes = await clickupFetch(
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

                let mediaUrls: string[] = [];
                if (fetch_attachments) {
                  try {
                    const taskDetail = await clickupFetch(`/task/${task.id}`, CLICKUP_TOKEN);
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
                } catch (insertErr: any) {
                  errors.push(`Task "${task.name}": ${insertErr.message}`);
                }
              } catch (e: any) {
                errors.push(`Task "${task.name}": ${e.message}`);
              }
            }

            if (tasks.length < 100) hasMore = false;
            else page++;
          } catch (e: any) {
            errors.push(`List ${mapping.list_id}: ${e.message}`);
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

      const items = await query<any>(
        `SELECT id, metadata, media_urls FROM planning_items
          WHERE workspace_id = $1 AND metadata IS NOT NULL LIMIT $2`,
        [workspace_id, limit]
      );

      const itemsToProcess = items.filter((item: any) => {
        const urls = item.media_urls;
        return !urls || (Array.isArray(urls) && urls.length === 0);
      });

      let updated = 0;
      const errors: string[] = [];

      for (const item of itemsToProcess) {
        const meta = item.metadata as any;
        if (!meta?.clickup_task_id) continue;

        try {
          const taskDetail = await clickupFetch(`/task/${meta.clickup_task_id}`, CLICKUP_TOKEN);
          const attachments = taskDetail.attachments || [];
          if (attachments.length === 0) continue;

          const mediaUrls: string[] = [];
          for (const att of attachments.slice(0, 5)) {
            const publicUrl = await uploadAttachmentToBlob(att, meta.clickup_task_id, CLICKUP_TOKEN);
            if (publicUrl) mediaUrls.push(publicUrl);
          }

          if (mediaUrls.length > 0) {
            await pool.query(`UPDATE planning_items SET media_urls = $1 WHERE id = $2`, [
              mediaUrls,
              item.id,
            ]);
            updated++;
          }
        } catch (e: any) {
          errors.push(`Item ${item.id}: ${e.message}`);
        }
      }

      return res.status(200).json({ updated, errors: errors.slice(0, 20) });
    }

    return res.status(400).json({
      error:
        'Unknown action. Use ?action=discover, ?action=import, or ?action=fetch-attachments',
    });
  } catch (e: any) {
    console.error('import-clickup error:', e);
    return res.status(500).json({ error: e.message });
  }
}
