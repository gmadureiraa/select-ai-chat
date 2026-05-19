// Migrated from supabase/functions/publish-viral-carousel/index.ts
// Storage migrated 2026-05-08 → Vercel Blob (era Supabase Storage legacy).
// Publisher 2026-05-17 → Late.ai como único provider (Postiz arquivado).
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import { assertClientAccess } from '../_lib/access.js';
import latePostHandler from './late-post.js';
import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SlideInput {
  order: number;
  dataUrl: string; // "data:image/png;base64,..."
}
type LatePayload = {
  error?: string;
  [key: string]: unknown;
};

const MAX_SLIDES = 10;
const MAX_DATAURL_BYTES = 8 * 1024 * 1024;
const MAX_CAPTION = 2200;

function dataUrlToBytes(dataUrl: string): { bytes: Buffer; mime: string } | null {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    return { bytes: Buffer.from(m[2], 'base64'), mime: m[1] };
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

export default authedPost(async ({ user, body, req, res }) => {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('BLOB_READ_WRITE_TOKEN not configured for storage');
  }

  const {
    carouselId,
    clientId,
    caption,
    slides,
    scheduledFor,
    planningItemId,
  } = body as {
    carouselId?: string;
    clientId?: string;
    caption?: string;
    slides?: SlideInput[];
    scheduledFor?: string;
    planningItemId?: string;
  };

  if (!carouselId || !clientId || !caption || !Array.isArray(slides) || slides.length === 0) {
    throw new Error('Campos obrigatórios: carouselId, clientId, caption, slides[]');
  }
  if (slides.length > MAX_SLIDES) {
    throw new Error(`Máximo de ${MAX_SLIDES} slides por carrossel no Instagram`);
  }
  if (caption.length > MAX_CAPTION) {
    throw new Error(`Caption excede ${MAX_CAPTION} chars`);
  }

  const { workspaceId } = await assertClientAccess(user.id, clientId);

  const carousel = await queryOne<{ planning_item_id: string | null }>(
    `SELECT planning_item_id
       FROM viral_carousels
      WHERE id = $1
        AND client_id = $2
        AND workspace_id = $3
      LIMIT 1`,
    [carouselId, clientId, workspaceId],
  );
  if (!carousel) {
    throw new Error('Carrossel não encontrado ou fora do cliente/workspace');
  }

  const sortedSlides = [...slides].sort((a, b) => a.order - b.order);
  const mediaUrls: string[] = [];
  const ts = Date.now();

  for (const slide of sortedSlides) {
    if (typeof slide.dataUrl !== 'string') {
      throw new Error(`Slide ${slide.order}: dataUrl inválido`);
    }
    if (slide.dataUrl.length > MAX_DATAURL_BYTES * 1.4) {
      throw new Error(`Slide ${slide.order}: PNG muito grande (>${MAX_DATAURL_BYTES} bytes)`);
    }
    const decoded = dataUrlToBytes(slide.dataUrl);
    if (!decoded) {
      throw new Error(`Slide ${slide.order}: data URL malformado`);
    }

    const blobPath = `viral-carousel-renders/${clientId}/${carouselId}/${ts}-slide-${String(slide.order).padStart(2, '0')}.png`;
    try {
      const blob = await put(blobPath, decoded.bytes, {
        access: 'public',
        contentType: decoded.mime,
        addRandomSuffix: false,
        allowOverwrite: true,
        token: blobToken,
      });
      mediaUrls.push(blob.url);
    } catch (upErr: unknown) {
      console.error(`[publish-viral-carousel] upload slide ${slide.order} failed:`, upErr);
      throw new Error(`Falha no upload do slide ${slide.order}: ${errorMessage(upErr)}`);
    }
  }

  console.log(`[publish-viral-carousel] uploaded ${mediaUrls.length} slides for carousel ${carouselId}`);

  // 2026-05-18 fix: se o caller (SV preview) não passar planningItemId, tenta
  // resolver via FK viral_carousels.planning_item_id. Sem isso o publishViaLate
  // não atualiza o planning_item correspondente quando o user publica direto
  // pelo botão "Publicar/Agendar" do preview do SV, deixando o card no Kanban
  // travado em status='scheduled' mesmo após postagem confirmada na Late.
  const resolvedPlanningItemId = planningItemId || carousel.planning_item_id || undefined;
  if (resolvedPlanningItemId) {
    const planningItem = await queryOne<{ id: string }>(
      `SELECT id
         FROM planning_items
        WHERE id = $1
          AND client_id = $2
          AND workspace_id = $3
        LIMIT 1`,
      [resolvedPlanningItemId, clientId, workspaceId],
    );
    if (!planningItem) {
      throw new Error('planningItemId não pertence ao mesmo cliente/workspace do carrossel');
    }
  }

  // Call late-post handler in-process via a captured pseudo response.
  const lateBody = {
    clientId,
    platform: 'instagram',
    content: caption,
    mediaUrls,
    planningItemId: resolvedPlanningItemId,
    scheduledFor,
    publishNow: !scheduledFor,
  };

  const publishHandler = latePostHandler;

  let latePayload: LatePayload | null = null;
  let lateStatus = 200;
  const mockRes = {
    statusCode: 200,
    writableEnded: false,
    setHeader: () => {},
    status(code: number) {
      this.statusCode = code;
      lateStatus = code;
      return this;
    },
    json(payload: unknown) {
      latePayload = payload && typeof payload === 'object'
        ? payload as LatePayload
        : { error: String(payload) };
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
  } as unknown as VercelResponse;

  const mockReq = {
    method: 'POST',
    headers: req.headers,
    body: lateBody,
    query: {},
  } as unknown as VercelRequest;

  await (publishHandler as unknown as (mockReq: VercelRequest, mockRes: VercelResponse) => Promise<void>)(mockReq, mockRes);

  if (lateStatus >= 400 || !latePayload) {
    console.error(`[publish-viral-carousel] late-post failed:`, lateStatus, latePayload);
    res.status(502).json({
      error: latePayload?.error || `late-post falhou (${lateStatus})`,
      details: latePayload,
      mediaUrls,
    });
    return;
  }

  // Update carousel state
  const updateResult = await getPool().query(
    `UPDATE viral_carousels
        SET status = $1,
            published_at = $2,
            scheduled_for = $3,
            last_publish_media_urls = $4::jsonb
      WHERE id = $5
        AND client_id = $6
        AND workspace_id = $7`,
    [
      scheduledFor ? 'scheduled' : 'published',
      scheduledFor ? null : new Date().toISOString(),
      scheduledFor ?? null,
      JSON.stringify(mediaUrls),
      carouselId,
      clientId,
      workspaceId,
    ]
  );
  if (updateResult.rowCount !== 1) {
    throw new Error('Falha ao atualizar carrossel publicado');
  }

  return {
    ok: true,
    mediaUrls,
    latePost: latePayload,
  };
});
