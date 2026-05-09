
// 2026-05-08 — `jszip` e `html-to-image` agora são dynamic imports dentro de
// `buildSlidesZip` pra que o chunk `export-zip-vendor` (jszip ~150kB) e
// `export-html-vendor` (html-to-image ~200kB) só baixem quando alguém chamar
// essa função. Como hoje nenhum call-site importa esse arquivo, na prática
// ele vive como helper pronto-pra-uso sem custo no bundle initial.

/**
 * Monta um arquivo ZIP client-side contendo os PNGs dos slides e, se disponível,
 * o PDF. Usado como opção adicional ao export PNG/PDF existente.
 *
 * Dependência: `jszip` (adicionada ao package.json).
 *
 * Uso típico:
 *   const blob = await buildSlidesZip(refs.current, { filename: "meu-carrossel" });
 *   downloadBlob(blob, "meu-carrossel.zip");
 */

export type BuildZipOptions = {
  filename?: string;
  /** Função async que devolve o PDF bytes (opcional). */
  pdfBytes?: () => Promise<Uint8Array | null>;
  /** Manifest JSON opcional (será salvo como manifest.json). */
  manifest?: Record<string, unknown>;
  onProgress?: (msg: string) => void;
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildSlidesZip(
  slideRefs: Array<HTMLDivElement | null>,
  opts: BuildZipOptions = {}
): Promise<Blob> {
  const [{ default: JSZip }, { toPng }] = await Promise.all([
    import("jszip"),
    import("html-to-image"),
  ]);
  const zip = new JSZip();
  const base = (opts.filename || "sequencia-viral-carrossel")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50);

  for (let i = 0; i < slideRefs.length; i++) {
    const node = slideRefs[i];
    if (!node) continue;
    opts.onProgress?.(`Gerando slide ${i + 1}/${slideRefs.length}...`);
    const dataUrl = await toPng(node, {
      width: 1080,
      height: 1350,
      pixelRatio: 1,
      cacheBust: false,
    });
    const bytes = dataUrlToBytes(dataUrl);
    zip.file(`slides/slide-${String(i + 1).padStart(2, "0")}.png`, bytes);
  }

  if (opts.pdfBytes) {
    opts.onProgress?.("Anexando PDF...");
    try {
      const pdf = await opts.pdfBytes();
      if (pdf) zip.file(`${base}.pdf`, pdf);
    } catch (err) {
      console.warn("[export-zip] pdf falhou, zip sai só com PNGs:", err);
    }
  }

  if (opts.manifest) {
    zip.file(
      "manifest.json",
      JSON.stringify(
        { ...opts.manifest, generated_at: new Date().toISOString() },
        null,
        2
      )
    );
  }

  opts.onProgress?.("Compactando ZIP...");
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
