/**
 * Export de carrossel viral — gera PNGs (um por slide) empacotados em ZIP,
 * ou gera um PDF com todos os slides em páginas separadas.
 *
 * Usa html-to-image pra renderizar offscreen. Cada slide é renderizado no
 * tamanho full 1080×1350 (não a scale de preview) pra qualidade
 * Instagram-ready.
 *
 * Limitações:
 *   - Imagens externas (Unsplash Source) podem dar CORS tainted em canvas;
 *     se acontecer, o PNG exporta sem a imagem embutida. Workaround futuro:
 *     proxy same-origin pra imagens externas (a gente copia do sequencia-viral).
 *   - Não exporta em ZIP por ora — dispara N downloads separados (simples,
 *     testável, zero deps).
 */

import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import type { ViralCarousel } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

/**
 * Renderiza o nó já no DOM (o preview do slide no grid) em canvas full-size.
 * Retorna base64 da imagem PNG.
 */
export async function slideNodeToPng(node: HTMLElement): Promise<string> {
  // O nó tem transform:scale(X) aplicado. Pra exportar em tamanho original,
  // usamos canvasWidth/canvasHeight em html-to-image, que ignora o scale.
  return toPng(node, {
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    pixelRatio: 1,
    skipFonts: false,
    cacheBust: true,
    // background branco pra evitar transparência estranha
    backgroundColor: "#FFFFFF",
  });
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Coleta os nós DOM de cada slide e dispara download de cada um como PNG.
 * O caller passa um Map<slideId, HTMLElement>.
 */
export async function exportCarouselAsPngs(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  const baseName = carousel.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "carrossel";
  for (const slide of carousel.slides) {
    const node = slideNodes.get(slide.id);
    if (!node) {
      failed++;
      continue;
    }
    try {
      const png = await slideNodeToPng(node);
      downloadDataUrl(png, `${baseName}-${String(slide.order).padStart(2, "0")}.png`);
      ok++;
      // Pequeno delay entre downloads pro browser não bloquear o lote
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.warn(`[exportCarousel] slide ${slide.order} failed:`, err);
      failed++;
    }
  }
  return { ok, failed };
}

/**
 * Exporta o carrossel completo como PDF — uma página 4:5 por slide.
 */
export async function exportCarouselAsPdf(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  // Página 1080×1350 pt (pode escalar)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [CANVAS_W, CANVAS_H],
  });
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < carousel.slides.length; i++) {
    const slide = carousel.slides[i];
    const node = slideNodes.get(slide.id);
    if (!node) {
      failed++;
      continue;
    }
    try {
      const png = await slideNodeToPng(node);
      if (i > 0) pdf.addPage([CANVAS_W, CANVAS_H], "portrait");
      pdf.addImage(png, "PNG", 0, 0, CANVAS_W, CANVAS_H);
      ok++;
    } catch (err) {
      console.warn(`[exportCarousel pdf] slide ${slide.order} failed:`, err);
      failed++;
    }
  }
  const baseName = carousel.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "carrossel";
  pdf.save(`${baseName}.pdf`);
  return { ok, failed };
}
