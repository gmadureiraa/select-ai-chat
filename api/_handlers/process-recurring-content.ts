// Migrated from supabase/functions/process-recurring-content/index.ts
// Generates planning_items from recurrence templates (daily/weekly/biweekly/monthly).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';
import { assertCronAuth } from '../_lib/cron-auth.js';

interface RecurringTemplate {
  id: string;
  workspace_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  content: string | null;
  column_id: string | null;
  platform: string | null;
  content_type: string | null;
  priority: string | null;
  recurrence_type: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_days: string[];
  recurrence_time: string | null;
  recurrence_end_date: string | null;
  created_by: string;
  assigned_to: string | null;
  generate_with_ai?: boolean;
  metadata?: Record<string, unknown>;
}

interface RecurringTaskTemplate {
  id: string;
  workspace_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  labels: unknown[];
  mentions: string[];
  recurrence_type: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_days: string[];
  recurrence_time: string | null;
  recurrence_end_date: string | null;
}

function shouldCreateTaskToday(template: RecurringTaskTemplate): boolean {
  return shouldCreateToday(template as unknown as RecurringTemplate);
}

function shouldCreateToday(template: RecurringTemplate): boolean {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (template.recurrence_end_date && template.recurrence_end_date < today) return false;

  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dayOfMonth = now.getDate();

  switch (template.recurrence_type) {
    case 'daily':
      return true;
    case 'weekly':
      return template.recurrence_days?.includes(dayOfWeek) || false;
    case 'biweekly': {
      const weekNumber = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      if (weekNumber % 2 !== 0) return false;
      return template.recurrence_days?.includes(dayOfWeek) || false;
    }
    case 'monthly':
      if (template.recurrence_days?.some((d) => !isNaN(parseInt(d)))) {
        return template.recurrence_days.includes(dayOfMonth.toString());
      }
      return dayOfMonth <= 7 && dayOfWeek === 'monday';
    default:
      return false;
  }
}

function shouldGenerateWithAI(template: RecurringTemplate): boolean {
  if (template.generate_with_ai === true) return true;
  if (template.description && !template.content) return true;
  const metadata = template.metadata as Record<string, unknown> | undefined;
  if (metadata?.generate_with_ai === true) return true;
  return false;
}

function getOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function callInternal(
  req: VercelRequest,
  path: string,
  body: any,
  authToken?: string,
): Promise<any> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Auth resolution order:
    // 1. authToken arg explícito
    // 2. Authorization header do request original (caso manual trigger)
    // 3. CRON_SECRET — cron NÃO tem JWT do user; sem isso AI gen sempre cai
    //    em 401 e recurrence usa fallback `description`. Handler-alvo aceita
    //    via Bearer ${CRON_SECRET} (isValidCronCall em handlers user-or-cron).
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    } else if (req.headers.authorization) {
      headers.Authorization = String(req.headers.authorization);
    } else if (process.env.CRON_SECRET) {
      headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
    }
    const r = await fetch(`${getOrigin(req)}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: json };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

async function generateAIContent(
  req: VercelRequest,
  template: RecurringTemplate,
): Promise<{ content: string; images: string[] } | null> {
  if (!template.client_id) return null;
  const format = template.content_type || 'instagram_carousel';
  const brief = template.description || template.title;
  console.log(`[process-recurring-content] AI gen for: ${template.title}`);
  try {
    const resp = await callInternal(req, '/api/unified-content-api', {
      client_id: template.client_id,
      format,
      brief,
      title: template.title,
      generate_images: false,
    });
    if (!resp.ok) {
      console.error(`[process-recurring-content] AI failed: ${resp.status}`, resp.data?.error);
      return null;
    }
    const result = resp.data;
    if (result?.content) {
      return {
        content: result.content,
        images: result.images || [],
      };
    }
    return null;
  } catch (e) {
    console.error('[process-recurring-content] AI gen error:', e);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // Auth: SOMENTE cron — esse handler materializa planning_items GLOBAIS
  // de TODOS os workspaces. Permitir trigger por user autenticado seria
  // privilege escalation. Header `x-vercel-cron` standalone NÃO é confiável.
  if (!assertCronAuth(req, res)) return;

  try {
    console.log('[process-recurring-content] starting...');
    const templates = await query<RecurringTemplate>(
      `SELECT * FROM planning_items
       WHERE is_recurrence_template = true
         AND recurrence_type IS NOT NULL
         AND recurrence_type <> 'none'`,
    );
    console.log(`[process-recurring-content] ${templates.length} template(s)`);

    const today = new Date().toISOString().split('T')[0];
    const results: Array<{
      templateId: string;
      created: boolean;
      itemId?: string;
      aiGenerated?: boolean;
      error?: string;
    }> = [];

    for (const template of templates) {
      try {
        if (!shouldCreateToday(template)) {
          results.push({ templateId: template.id, created: false });
          continue;
        }
        // CONCURRENCY: 2 crons paralelos rodando podem ambos passar pelo SELECT
        // sem ver row e ambos INSERTar — duplicava planning_items.
        // Migration 0044 criou unique index `uq_planning_items_recurrence_per_day`
        // em (recurrence_parent_id, DATE(created_at AT TIME ZONE 'UTC')).
        // O INSERT abaixo usa ON CONFLICT DO NOTHING — race-safe.
        // Mantém SELECT como fast-path pra economizar Gemini calls quando
        // já tem item criado (não vale a pena gerar conteúdo + bloquear no
        // INSERT). É só optimization, não correctness.
        const existing = await query<any>(
          `SELECT id FROM planning_items
           WHERE recurrence_parent_id = $1
             AND created_at >= $2 AND created_at <= $3
           LIMIT 1`,
          [template.id, `${today}T00:00:00`, `${today}T23:59:59`],
        );
        if (existing.length > 0) {
          results.push({ templateId: template.id, created: false });
          continue;
        }

        let finalContent: string | null = template.content;
        let aiGenerated = false;
        let generatedImages: string[] = [];

        if (shouldGenerateWithAI(template)) {
          const aiResult = await generateAIContent(req, template);
          if (aiResult) {
            finalContent = aiResult.content;
            generatedImages = aiResult.images;
            aiGenerated = true;
          } else {
            finalContent = template.description || template.content;
          }
        }

        const scheduledTime = template.recurrence_time
          ? `${today}T${template.recurrence_time}`
          : null;

        const newItem = await queryOne<any>(
          `INSERT INTO planning_items
            (workspace_id, client_id, title, description, content, column_id, platform, content_type,
             priority, status, created_by, assigned_to, recurrence_parent_id, scheduled_at, due_date,
             metadata${generatedImages.length > 0 ? ', media_urls' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'idea', $10, $11, $12, $13, $14, $15::jsonb${
             generatedImages.length > 0 ? ', $16' : ''
           })
           RETURNING id`,
          generatedImages.length > 0
            ? [
                template.workspace_id,
                template.client_id,
                template.title,
                template.description,
                finalContent,
                template.column_id,
                template.platform,
                template.content_type,
                template.priority,
                template.created_by,
                template.assigned_to,
                template.id,
                scheduledTime,
                today,
                JSON.stringify({
                  generated_from_recurrence: true,
                  recurrence_template_id: template.id,
                  ai_generated: aiGenerated,
                }),
                generatedImages,
              ]
            : [
                template.workspace_id,
                template.client_id,
                template.title,
                template.description,
                finalContent,
                template.column_id,
                template.platform,
                template.content_type,
                template.priority,
                template.created_by,
                template.assigned_to,
                template.id,
                scheduledTime,
                today,
                JSON.stringify({
                  generated_from_recurrence: true,
                  recurrence_template_id: template.id,
                  ai_generated: aiGenerated,
                }),
              ],
        );

        if (newItem?.id) {
          console.log(`[process-recurring-content] created ${newItem.id} (AI=${aiGenerated})`);
          results.push({ templateId: template.id, created: true, itemId: newItem.id, aiGenerated });
        } else {
          results.push({ templateId: template.id, created: false, error: 'insert returned no id' });
        }
      } catch (templateError: any) {
        console.error(`[process-recurring-content] error for template ${template.id}:`, templateError);
        results.push({
          templateId: template.id,
          created: false,
          error: templateError?.message || 'Unknown error',
        });
      }
    }

    const createdCount = results.filter((r) => r.created).length;
    const aiGeneratedCount = results.filter((r) => r.aiGenerated).length;
    console.log(`[process-recurring-content] done. created=${createdCount} ai=${aiGeneratedCount}`);

    // -----------------------------------------------------------------
    // Tasks recorrentes (team_tasks com is_recurrence_template=true)
    // -----------------------------------------------------------------
    const taskTemplates = await query<RecurringTaskTemplate>(
      `SELECT *
         FROM team_tasks
        WHERE is_recurrence_template = true
          AND recurrence_type IS NOT NULL
          AND recurrence_type <> 'none'`,
    ).catch((error: any) => {
      console.warn('[process-recurring-content] recurring tasks unavailable:', error?.message);
      return [] as RecurringTaskTemplate[];
    });

    const taskResults: Array<{
      templateId: string;
      created: boolean;
      taskId?: string;
      error?: string;
    }> = [];

    for (const template of taskTemplates) {
      try {
        if (!shouldCreateTaskToday(template)) {
          taskResults.push({ templateId: template.id, created: false });
          continue;
        }
        const existing = await query<{ id: string }>(
          `SELECT id
             FROM team_tasks
            WHERE recurrence_parent_id = $1
              AND created_at >= $2
              AND created_at <= $3`,
          [template.id, `${today}T00:00:00`, `${today}T23:59:59`],
        );
        if (existing.length > 0) {
          taskResults.push({ templateId: template.id, created: false });
          continue;
        }
        const countRow = await queryOne<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM team_tasks WHERE workspace_id = $1 AND status = 'todo'`,
          [template.workspace_id],
        );
        const task = await queryOne<{ id: string }>(
          `INSERT INTO team_tasks
             (workspace_id, client_id, title, description, status, priority, due_date,
              assigned_to, created_by, position, labels, mentions, recurrence_parent_id,
              is_recurrence_template)
           VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7, $8, $9, $10::jsonb, $11::uuid[], $12, false)
           RETURNING id`,
          [
            template.workspace_id,
            template.client_id,
            template.title,
            template.description,
            template.priority || 'medium',
            today,
            template.assigned_to,
            template.created_by,
            (countRow?.c || 0) + 1,
            JSON.stringify(template.labels || []),
            template.mentions || [],
            template.id,
          ],
        );
        await query(
          `UPDATE team_tasks SET last_recurrence_created_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [template.id],
        ).catch(() => null);
        taskResults.push({ templateId: template.id, created: true, taskId: task?.id });
      } catch (taskError: any) {
        console.error(`[process-recurring-content] task recurrence error for ${template.id}:`, taskError);
        taskResults.push({
          templateId: template.id,
          created: false,
          error: taskError?.message || 'Unknown error',
        });
      }
    }

    const tasksCreated = taskResults.filter((r) => r.created).length;
    console.log(`[process-recurring-content] recurring tasks done. created=${tasksCreated}`);

    return res.status(200).json({
      success: true,
      templatesProcessed: templates.length,
      itemsCreated: createdCount,
      aiGenerated: aiGeneratedCount,
      taskTemplatesProcessed: taskTemplates.length,
      tasksCreated,
      results,
      taskResults,
    });
  } catch (error: any) {
    console.error('[process-recurring-content] fatal:', error);
    return jsonError(res, 500, error?.message || 'Unknown error');
  }
}
