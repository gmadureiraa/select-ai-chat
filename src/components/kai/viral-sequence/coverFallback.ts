/**
 * coverFallback — gerador de capa SVG quando o RSS/upload falha ou não traz imagem.
 *
 * Estratégia:
 *   - Hash do título → seleciona paleta (5 paletas estilo "newspaper")
 *   - Compõe SVG 1080×1350 com gradiente diagonal + textura sutil
 *   - Retorna data-URL pronta pra usar no <img> (não precisa upload)
 *
 * Usado em:
 *   - generate-viral-carousel (server) quando coverImageUrl ausente
 *   - SlideEditor cliente quando user marca "Imagem como capa" mas não escolheu nada
 */

import type { ImageSource } from "./types";

interface Palette {
  id: string;
  name: string;
  /** Cor 1, cor 2 (gradient diagonal). */
  colors: [string, string];
  /** Cor de acento para forma decorativa. */
  accent: string;
}

const PALETTES: Palette[] = [
  { id: "indigo", name: "Indigo", colors: ["#1e1b4b", "#4338ca"], accent: "#a78bfa" },
  { id: "rose", name: "Rose", colors: ["#881337", "#e11d48"], accent: "#fbcfe8" },
  { id: "emerald", name: "Emerald", colors: ["#022c22", "#059669"], accent: "#a7f3d0" },
  { id: "amber", name: "Amber", colors: ["#451a03", "#d97706"], accent: "#fde68a" },
  { id: "slate", name: "Slate", colors: ["#0f172a", "#475569"], accent: "#cbd5e1" },
  { id: "sky", name: "Sky", colors: ["#082f49", "#0284c7"], accent: "#bae6fd" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickPalette(seed: string): Palette {
  return PALETTES[hashString(seed) % PALETTES.length];
}

/**
 * Gera SVG 1080×1350 como data-URL.
 * Carrega no <img> instantaneamente, sem network, sem CORS.
 */
export function generateCoverFallback(seedText: string): {
  dataUrl: string;
  palette: Palette;
} {
  const palette = pickPalette(seedText || "default");
  const seed = hashString(seedText || "default");
  // 3 círculos decorativos posicionados deterministicamente pelo seed
  const c1x = (seed % 600) + 200;
  const c1y = ((seed >> 4) % 600) + 200;
  const c2x = ((seed >> 8) % 700) + 100;
  const c2y = ((seed >> 12) % 700) + 400;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.colors[0]}"/>
        <stop offset="100%" stop-color="${palette.colors[1]}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#bg)"/>
    <circle cx="${c1x}" cy="${c1y}" r="280" fill="${palette.accent}" opacity="0.12"/>
    <circle cx="${c2x}" cy="${c2y}" r="180" fill="${palette.accent}" opacity="0.08"/>
    <rect width="1080" height="1350" fill="url(#glow)"/>
  </svg>`;

  // encodeURIComponent é mais leve que btoa pra SVG (chars ascii-only)
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { dataUrl, palette };
}

/**
 * Cria uma ImageSource fallback pronta pra usar em ViralSlide.image.
 */
export function buildFallbackImageSource(seedText: string): ImageSource {
  const { dataUrl, palette } = generateCoverFallback(seedText);
  return {
    kind: "fallback",
    url: dataUrl,
    palette: palette.name,
    seed: seedText.slice(0, 60),
  };
}

export const COVER_FALLBACK_PALETTES = PALETTES;
