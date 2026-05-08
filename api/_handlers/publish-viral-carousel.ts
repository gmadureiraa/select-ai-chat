// Migrated from supabase/functions/publish-viral-carousel/index.ts
// Storage uploads continue using Supabase Storage SDK (bucket: viral-carousel-renders).
import { authedPost } from '../_lib/handler.js';
import { getPool, queryOne } from '../_lib/db.js';
import latePostHandler from './late-post.js';
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SlideInput {
  order: number;
  dataUrl: string; // "data:image/png;base64,..."
}

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

export default authedPost(async ({ user, body, req, res }) => {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured for storage');
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

  // Verify user has access to this client (workspace membership)
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
       FROM clients c
       JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = $1 AND wm.user_id = $2
      LIMIT 1`,
    [clientId, user.id]
  );
  if (!access) {
    throw new Error('Acesso negado a esse cliente');
  }

  const supabaseStorage = createClient(SUPABASE_URL, SERVICE_KEY);
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

    const path = `${clientId}/${carouselId}/${ts}-slide-${String(slide.order).padStart(2, '0')}.png`;
    const { error: upErr } = await supabaseStorage.storage
      .from('viral-carousel-renders')
      .upload(path, decoded.bytes, {
        contentType: decoded.mime,
        upsert: true,
      });

    if (upErr) {
      console.error(`[publish-viral-carousel] upload slide ${slide.order} failed:`, upErr);
      throw new Error(`Falha no upload do slide ${slide.order}: ${upErr.message}`);
    }

    const { data: pub } = supabaseStorage.storage
      .from('viral-carousel-renders')
      .getPublicUrl(path);
    mediaUrls.push(pub.publicUrl);
  }

  console.log(`[publish-viral-carousel] uploaded ${mediaUrls.length} slides for carousel ${carouselId}`);

  // Call late-post handler in-process via a captured pseudo response
  const lateBody = {
    clientId,
    platform: 'instagram',
    content: caption,
    mediaUrls,
    planningItemId,
    scheduledFor,
    publishNow: !scheduledFor,
  };

  let latePayload: any = null;
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
    json(payload: any) {
      latePayload = payload;
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
  } as any as VercelResponse;

  const mockReq = {
    method: 'POST',
    headers: req.headers,
    body: lateBody,
    query: {},
  } as any as VercelRequest;

  await (latePostHandler as any)(mockReq, mockRes);

  if (lateStatus >= 400 || !latePayload) {
    console.error('[publish-viral-carousel] late-post failed:', lateStatus, latePayload);
    res.status(502).json({
      error: latePayload?.error || `late-post falhou (${lateStatus})`,
      details: latePayload,
      mediaUrls,
    });
    return;
  }

  // Update carousel state
  await getPool().query(
    `UPDATE viral_carousels
        SET status = $1,
            published_at = $2,
            scheduled_for = $3,
            last_publish_media_urls = $4::jsonb
      WHERE id = $5`,
    [
      scheduledFor ? 'scheduled' : 'published',
      scheduledFor ? null : new Date().toISOString(),
      scheduledFor ?? null,
      JSON.stringify(mediaUrls),
      carouselId,
    ]
  );

  return {
    ok: true,
    mediaUrls,
    latePost: latePayload,
  };
});
