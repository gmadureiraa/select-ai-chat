/**
 * Shim de `next/font/google` → no-op factory.
 *
 * Cada Family() retorna um objeto com a mesma shape que o Next gera
 * (`{ variable, className, style }`), mas as fonts em si vêm via
 * `<link>` no `index.html` (pré-carregadas globalmente).
 *
 * `variable` é mantido pra que `<div className={font.variable}>` continue
 * aplicando uma classe CSS válida (no-op visual; vars já vêm de globals.css).
 */

interface FontConfig {
  variable?: string;
  subsets?: string[];
  weight?: string | string[];
  style?: string | string[];
  display?: string;
}

interface NextFont {
  variable: string;
  className: string;
  style: { fontFamily: string };
}

function fontFactory(name: string) {
  return (config: FontConfig = {}): NextFont => ({
    variable: config.variable ?? `--font-${name.toLowerCase().replace(/_/g, "-")}`,
    className: `font-${name.toLowerCase().replace(/_/g, "-")}`,
    style: { fontFamily: name.replace(/_/g, " ") },
  });
}

export const Plus_Jakarta_Sans = fontFactory("Plus_Jakarta_Sans");
export const Instrument_Serif = fontFactory("Instrument_Serif");
export const JetBrains_Mono = fontFactory("JetBrains_Mono");
export const DM_Serif_Display = fontFactory("DM_Serif_Display");
export const Playfair_Display = fontFactory("Playfair_Display");
export const Outfit = fontFactory("Outfit");
export const Inter = fontFactory("Inter");
export const Source_Sans_3 = fontFactory("Source_Sans_3");
export const Literata = fontFactory("Literata");
export const Geist = fontFactory("Geist");
export const Geist_Mono = fontFactory("Geist_Mono");
