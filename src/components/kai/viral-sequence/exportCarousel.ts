/**
 * Export de carrossel viral — gera PNGs (um por slide) ou ZIP único, ou PDF
 * com todos os slides em páginas separadas.
 *
 * Reescrito inspirado no postflow (gmadureiraa/postflow):
 *   - Espera fontes carregarem (`document.fonts.ready`).
 *   - Espera imagens carregarem com hard-cap 3s (CORS pode segurar load forever).
 *   - Usa `imagePlaceholder` 1×1 transparente: quando uma imagem CORS taintar
 *     o canvas, html-to-image substitui por placeholder em vez de abortar →
 *     export funciona, slide sai sem aquela imagem específica.
 *   - Recebe nós já em scale=1 (1080×1350) → captura native, sem upscale.
 *
 * Usa html-to-image + jszip + jspdf (já no package.json).
 */

import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import JSZip from "jszip";
import type { ViralCarousel } from "./types";
import { CANVAS_H, CANVAS_W } from "./types";

// 1×1 transparente — substitui imagens que falharem por CORS no canvas.
const PLACEHOLDER_1X1 =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const IMG_TIMEOUT_MS = 3000;

async function waitForImagesInElement(el: HTMLElement): Promise<void> {
  const imgs = el.querySelectorAll("img");
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(done, IMG_TIMEOUT_MS);
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

/**
 * Aguarda pré-condições pra captura: 2 RAFs, fontes prontas, imagens
 * carregadas, settle 500ms (containers off-screen com opacity:0 demoram
 * a pintar em webkit).
 */
async function waitForExportReady(nodes: HTMLElement[]): Promise<void> {
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      const fontsApi = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
      await fontsApi?.ready;
    } catch {
      /* best-effort */
    }
  }
  await Promise.all(nodes.map((n) => waitForImagesInElement(n)));
  await new Promise((r) => setTimeout(r, 500));
}

async function captureNodeAsPng(node: HTMLElement): Promise<string> {
  return toPng(node, {
    width: CANVAS_W,
    height: CANVAS_H,
    pixelRatio: 1,
    cacheBust: true,
    skipFonts: false,
    backgroundColor: "#FFFFFF",
    imagePlaceholder: PLACEHOLDER_1X1,
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function baseFilename(carousel: ViralCarousel): string {
  return (
    carousel.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) ||
    "carrossel"
  );
}

function collectNodes(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): { nodes: HTMLElement[]; missing: number[] } {
  const nodes: HTMLElement[] = [];
  const missing: number[] = [];
  for (const slide of carousel.slides) {
    const n = slideNodes.get(slide.id);
    if (n) nodes.push(n);
    else missing.push(slide.order);
  }
  return { nodes, missing };
}

/**
 * Export ZIP — RECOMENDADO. 1 download único contendo todos os slides PNG
 * em qualidade 1080×1350. Pronto pra subir no Instagram (zip → unzip → posta
 * carrossel selecionando os 8 PNGs em ordem).
 */
export async function exportCarouselAsZip(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  const { nodes, missing } = collectNodes(carousel, slideNodes);
  if (nodes.length === 0) {
    return { ok: 0, failed: carousel.slides.length };
  }
  await waitForExportReady(nodes);
  const zip = new JSZip();
  let ok = 0;
  let failed = missing.length;
  for (let i = 0; i < carousel.slides.length; i++) {
    const slide = carousel.slides[i];
    const node = slideNodes.get(slide.id);
    if (!node) continue;
    try {
      const dataUrl = await captureNodeAsPng(node);
      const base64 = dataUrl.split(",")[1] ?? "";
      if (!base64) {
        failed++;
        continue;
      }
      zip.file(
        `slide-${String(slide.order).padStart(2, "0")}.png`,
        base64,
        { base64: true },
      );
      ok++;
    } catch (err) {
      console.warn(`[exportCarousel zip] slide ${slide.order} falhou:`, err);
      failed++;
    }
  }
  if (ok === 0) return { ok, failed };
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  downloadBlob(blob, `${baseFilename(carousel)}.zip`);
  return { ok, failed };
}

/**
 * Export PNGs separados — dispara N downloads (1 por slide).
 * Mantido pra compat; prefira ZIP.
 */
export async function exportCarouselAsPngs(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  const { nodes, missing } = collectNodes(carousel, slideNodes);
  await waitForExportReady(nodes);
  let ok = 0;
  let failed = missing.length;
  const base = baseFilename(carousel);
  for (const slide of carousel.slides) {
    const node = slideNodes.get(slide.id);
    if (!node) continue;
    try {
      const png = await captureNodeAsPng(node);
      downloadDataUrl(
        png,
        `${base}-${String(slide.order).padStart(2, "0")}.png`,
      );
      ok++;
      // Pequeno delay entre downloads — alguns browsers bloqueiam batch.
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      console.warn(`[exportCarousel png] slide ${slide.order} falhou:`, err);
      failed++;
    }
  }
  return { ok, failed };
}

/**
 * Export PDF — todos os slides em páginas 1080×1350.
 */
export async function exportCarouselAsPdf(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  const { nodes, missing } = collectNodes(carousel, slideNodes);
  await waitForExportReady(nodes);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [CANVAS_W, CANVAS_H],
    compress: true,
  });
  let ok = 0;
  let failed = missing.length;
  for (let i = 0; i < carousel.slides.length; i++) {
    const slide = carousel.slides[i];
    const node = slideNodes.get(slide.id);
    if (!node) continue;
    try {
      const png = await captureNodeAsPng(node);
      if (ok > 0) pdf.addPage([CANVAS_W, CANVAS_H], "portrait");
      pdf.addImage(png, "PNG", 0, 0, CANVAS_W, CANVAS_H, undefined, "FAST");
      ok++;
    } catch (err) {
      console.warn(`[exportCarousel pdf] slide ${slide.order} falhou:`, err);
      failed++;
    }
  }
  if (ok === 0) return { ok, failed };
  const arrayBuf = pdf.output("arraybuffer");
  const blob = new Blob([arrayBuf], { type: "application/pdf" });
  downloadBlob(blob, `${baseFilename(carousel)}.pdf`);
  return { ok, failed };
}
