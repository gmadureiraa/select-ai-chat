/**
 * publish-viral-carousel
 *
 * Recebe slides PNG (data URLs) renderizados no client, faz upload no
 * bucket público `viral-carousel-renders` e dispara publicação no
 * Instagram via `late-post`.
 *
 * Body:
 *   {
 *     carouselId: string,
 *     clientId: string,
 *     caption: string,
 *     slides: Array<{ order: number, dataUrl: string }>,
 *     scheduledFor?: string (ISO),
 *     planningItemId?: string
 *   }
 *
 * Retorna:
 *   { ok: true, postId, mediaUrls: string[] }
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SlideInput {
  order: number;
  dataUrl: string; // "data:image/png;base64,..."
}

interface Body {
  carouselId: string;
  clientId: string;
  caption: string;
  slides: SlideInput[];
  scheduledFor?: string;
  planningItemId?: string;
}

const MAX_SLIDES = 10; // Instagram permite até 10 no carrossel
const MAX_DATAURL_BYTES = 8 * 1024 * 1024; // 8MB por slide é safe
const MAX_CAPTION = 2200; // limite IG

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  try {
    const binary = atob(m[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime };
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    const { carouselId, clientId, caption, slides, scheduledFor, planningItemId } = body;

    // Validação
    if (!carouselId || !clientId || !caption || !Array.isArray(slides) || slides.length === 0) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: carouselId, clientId, caption, slides[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (slides.length > MAX_SLIDES) {
      return new Response(
        JSON.stringify({ error: `Máximo de ${MAX_SLIDES} slides por carrossel no Instagram` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (caption.length > MAX_CAPTION) {
      return new Response(
        JSON.stringify({ error: `Caption excede ${MAX_CAPTION} chars` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verifica se o usuário tem acesso ao cliente
    const supabaseService = createClient(supabaseUrl, serviceKey);
    const { data: accessOk, error: accessErr } = await supabaseService.rpc(
      "client_workspace_accessible",
      { p_client_id: clientId, p_user_id: user.id },
    );
    if (accessErr || !accessOk) {
      return new Response(
        JSON.stringify({ error: "Acesso negado a esse cliente" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upload dos PNGs
    const sortedSlides = [...slides].sort((a, b) => a.order - b.order);
    const mediaUrls: string[] = [];
    const ts = Date.now();

    for (const slide of sortedSlides) {
      if (typeof slide.dataUrl !== "string") {
        return new Response(
          JSON.stringify({ error: `Slide ${slide.order}: dataUrl inválido` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (slide.dataUrl.length > MAX_DATAURL_BYTES * 1.4) {
        return new Response(
          JSON.stringify({ error: `Slide ${slide.order}: PNG muito grande (>${MAX_DATAURL_BYTES} bytes)` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const decoded = dataUrlToBytes(slide.dataUrl);
      if (!decoded) {
        return new Response(
          JSON.stringify({ error: `Slide ${slide.order}: data URL malformado` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const path = `${clientId}/${carouselId}/${ts}-slide-${String(slide.order).padStart(2, "0")}.png`;
      const { error: upErr } = await supabaseService.storage
        .from("viral-carousel-renders")
        .upload(path, decoded.bytes, {
          contentType: decoded.mime,
          upsert: true,
        });

      if (upErr) {
        console.error(`[publish-viral-carousel] upload slide ${slide.order} failed:`, upErr);
        return new Response(
          JSON.stringify({ error: `Falha no upload do slide ${slide.order}: ${upErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: pub } = supabaseService.storage
        .from("viral-carousel-renders")
        .getPublicUrl(path);
      mediaUrls.push(pub.publicUrl);
    }

    console.log(`[publish-viral-carousel] uploaded ${mediaUrls.length} slides for carousel ${carouselId}`);

    // Chama late-post
    const lateRes = await fetch(`${supabaseUrl}/functions/v1/late-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        clientId,
        platform: "instagram",
        content: caption,
        mediaUrls,
        planningItemId,
        scheduledFor,
        publishNow: !scheduledFor,
      }),
    });

    const lateBody = await lateRes.json().catch(() => ({}));
    if (!lateRes.ok) {
      console.error("[publish-viral-carousel] late-post failed:", lateRes.status, lateBody);
      return new Response(
        JSON.stringify({
          error: lateBody?.error || `late-post falhou (${lateRes.status})`,
          details: lateBody,
          mediaUrls, // devolve URLs já pra debug
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Marca carousel como published
    await supabaseService
      .from("viral_carousels")
      .update({
        status: scheduledFor ? "scheduled" : "published",
        published_at: scheduledFor ? null : new Date().toISOString(),
        scheduled_for: scheduledFor ?? null,
        last_publish_media_urls: mediaUrls,
      })
      .eq("id", carouselId);

    return new Response(
      JSON.stringify({
        ok: true,
        mediaUrls,
        latePost: lateBody,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[publish-viral-carousel] unexpected error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
