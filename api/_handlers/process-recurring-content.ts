// Migrated from supabase/functions/process-recurring-content/index.ts
// Generates planning_items from recurrence templates (daily/weekly/biweekly/monthly).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';
import { getPool, query, queryOne } from '../_lib/db.js';
import { tryAuth } from '../_lib/auth.js';

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
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    else if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
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
  // privilege escalation (qualquer user dispara recurring de outro client).
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization;
  const isCron =
    req.headers['x-vercel-cron'] === '1' ||
    (cronSecret && auth === `Bearer ${cronSecret}`);
  if (!isCron) {
    return jsonError(res, 403, 'Cron-only endpoint');
  }

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
        // Already created today?
        const existing = await query<any>(
          `SELECT id FROM planning_items
           WHERE recurrence_parent_id = $1
             AND created_at >= $2 AND created_at <= $3`,
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

    return res.status(200).json({
      success: true,
      templatesProcessed: templates.length,
      itemsCreated: createdCount,
      aiGenerated: aiGeneratedCount,
      results,
    });
  } catch (error: any) {
    console.error('[process-recurring-content] fatal:', error);
    return jsonError(res, 500, error?.message || 'Unknown error');
  }
}
