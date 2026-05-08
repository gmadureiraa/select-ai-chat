/**
 * Export de carrossel viral v2 — gera PNGs (um por slide), ZIP único, ou PDF.
 *
 * Usa html-to-image + jszip + jspdf, lazy-loaded. Espera fontes/imagens
 * carregarem antes de capturar pra evitar slides quebrados.
 */

import { CANVAS_W, CANVAS_H, type ViralCarousel } from "../types";

type ToPngFn = typeof import("html-to-image").toPng;

// 1×1 transparente — substitui imagens que falharem por CORS.
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

async function captureNodeAsPng(toPng: ToPngFn, node: HTMLElement): Promise<string> {
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

export async function exportCarouselAsZip(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  const { nodes, missing } = collectNodes(carousel, slideNodes);
  if (nodes.length === 0) return { ok: 0, failed: carousel.slides.length };
  await waitForExportReady(nodes);
  const [{ default: JSZip }, { toPng }] = await Promise.all([
    import("jszip"),
    import("html-to-image"),
  ]);
  const zip = new JSZip();
  let ok = 0;
  let failed = missing.length;
  for (const slide of carousel.slides) {
    const node = slideNodes.get(slide.id);
    if (!node) continue;
    try {
      const dataUrl = await captureNodeAsPng(toPng, node);
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

export async function exportCarouselAsPngs(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  const { nodes, missing } = collectNodes(carousel, slideNodes);
  await waitForExportReady(nodes);
  const { toPng } = await import("html-to-image");
  let ok = 0;
  let failed = missing.length;
  const base = baseFilename(carousel);
  for (const slide of carousel.slides) {
    const node = slideNodes.get(slide.id);
    if (!node) continue;
    try {
      const png = await captureNodeAsPng(toPng, node);
      downloadDataUrl(
        png,
        `${base}-${String(slide.order).padStart(2, "0")}.png`,
      );
      ok++;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      console.warn(`[exportCarousel png] slide ${slide.order} falhou:`, err);
      failed++;
    }
  }
  return { ok, failed };
}

export async function exportCarouselAsPdf(
  carousel: ViralCarousel,
  slideNodes: Map<string, HTMLElement>,
): Promise<{ ok: number; failed: number }> {
  const { nodes, missing } = collectNodes(carousel, slideNodes);
  await waitForExportReady(nodes);
  const [{ default: jsPDF }, { toPng }] = await Promise.all([
    import("jspdf"),
    import("html-to-image"),
  ]);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [CANVAS_W, CANVAS_H],
    compress: true,
  });
  let ok = 0;
  let failed = missing.length;
  for (const slide of carousel.slides) {
    const node = slideNodes.get(slide.id);
    if (!node) continue;
    try {
      const png = await captureNodeAsPng(toPng, node);
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
