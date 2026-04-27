/**
 * Cliente para publicar carrossel viral no Instagram via Edge Function
 * `publish-viral-carousel`. Captura PNGs dos slides (em scale 1080×1350),
 * envia para storage e dispara LATE.
 */

import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import type { ViralCarousel } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

const PLACEHOLDER_1X1 =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

async function captureNode(node: HTMLElement): Promise<string> {
  return toPng(node, {
    width: CANVAS_W,
    height: CANVAS_H,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#FFFFFF",
    imagePlaceholder: PLACEHOLDER_1X1,
  });
}

async function waitForExportReady(nodes: HTMLElement[]): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      const fontsApi = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
      await fontsApi?.ready;
    } catch { /* best-effort */ }
  }
  await Promise.all(
    nodes.flatMap((n) =>
      Array.from(n.querySelectorAll("img")).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            const done = () => { clearTimeout(t); resolve(); };
            const t = setTimeout(done, 3000);
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
    ),
  );
  await new Promise((r) => setTimeout(r, 400));
}

export interface PublishOptions {
  caption: string;
  scheduledFor?: string;
  planningItemId?: string;
}

export interface PublishResult {
  ok: boolean;
  mediaUrls?: string[];
  error?: string;
}

/**
 * Renderiza cada slide como PNG, faz upload via edge function
 * `publish-viral-carousel` e publica no Instagram via LATE.
 *
 * @param carousel — carrossel atual (precisa estar salvo, com id estável)
 * @param exportNodes — Map slideId → HTMLElement (off-screen renderer em scale=1)
 * @param opts — caption + agendamento opcional
 */
export async function publishCarouselToInstagram(
  carousel: ViralCarousel,
  exportNodes: Map<string, HTMLElement>,
  opts: PublishOptions,
): Promise<PublishResult> {
  const filledSlides = carousel.slides.filter(
    (s) => (s.heading?.trim() ?? "") !== "" || s.body.trim() !== "" || s.image.kind !== "none",
  );
  if (filledSlides.length === 0) {
    return { ok: false, error: "Nenhum slide preenchido pra publicar" };
  }
  if (filledSlides.length > 10) {
    return { ok: false, error: "Instagram aceita no máximo 10 slides por carrossel" };
  }

  const nodes = filledSlides
    .map((s) => exportNodes.get(s.id))
    .filter((n): n is HTMLElement => !!n);
  if (nodes.length !== filledSlides.length) {
    return { ok: false, error: "Alguns slides não estão prontos pra renderização. Aguarde o preview carregar." };
  }

  await waitForExportReady(nodes);

  const slidesPayload: { order: number; dataUrl: string }[] = [];
  for (let i = 0; i < filledSlides.length; i++) {
    const slide = filledSlides[i];
    const node = exportNodes.get(slide.id);
    if (!node) continue;
    try {
      const dataUrl = await captureNode(node);
      slidesPayload.push({ order: slide.order, dataUrl });
    } catch (err) {
      console.error(`[publishCarousel] capture slide ${slide.order} failed:`, err);
      return { ok: false, error: `Falha ao renderizar slide ${slide.order}: ${(err as Error).message}` };
    }
  }

  const { data, error } = await supabase.functions.invoke("publish-viral-carousel", {
    body: {
      carouselId: carousel.id,
      clientId: carousel.clientId,
      caption: opts.caption,
      slides: slidesPayload,
      scheduledFor: opts.scheduledFor,
      planningItemId: opts.planningItemId,
    },
  });

  if (error) {
    console.error("[publishCarousel] edge function error:", error);
    return { ok: false, error: error.message };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || "Falha desconhecida na publicação" };
  }
  return { ok: true, mediaUrls: data.mediaUrls };
}
