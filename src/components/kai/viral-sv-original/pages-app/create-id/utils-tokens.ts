/**
 * utils-tokens.ts — helpers pra manipular tokens inline no body do slide.
 *
 * Convenção: `[<token>:<VALUE>]` (sem espaços) em qualquer lugar do body.
 * Usado principalmente pelo template `madureira-minimal` que aceita:
 *   - `[emoji:🚨]`            → emoji da capa
 *   - `[deco:notes|eyes|none]` → decoração SVG no modo TEXTO PURO
 *   - `[img2:URL]`            → ativa modo DUAS IMAGENS (URL secundária)
 *
 * Esses helpers expõem leitura/escrita controlada desses tokens
 * direto no string do body, sem precisar de schema extra no DB.
 */

/**
 * Extrai o valor de um token `[token:VALUE]` no body.
 * Retorna `null` se o token não existe.
 *
 * @example
 *   extractToken("oi [emoji:🚨] tudo bem", "emoji") // "🚨"
 *   extractToken("nada aqui", "emoji")              // null
 */
export function extractToken(body: string, token: string): string | null {
  if (!body || !token) return null;
  const safe = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[${safe}:([^\\]]+)\\]`);
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Substitui (ou remove) um token `[token:VALUE]` no body.
 * Se `value` é null/undefined/"", remove o token do body.
 * Se o token já existe, substitui in-place.
 * Se não existe, append no final do body (com espaço de separação).
 *
 * Sempre normaliza espaços duplicados resultantes da remoção.
 *
 * @example
 *   setToken("oi", "emoji", "🚨")              // "oi [emoji:🚨]"
 *   setToken("oi [emoji:🚨]", "emoji", "⚡")    // "oi [emoji:⚡]"
 *   setToken("oi [emoji:🚨]", "emoji", null)   // "oi"
 */
export function setToken(
  body: string,
  token: string,
  value: string | null | undefined,
): string {
  const safe = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\s*\\[${safe}:[^\\]]+\\]\\s*`, "g");
  // Remove qualquer ocorrência existente.
  const cleaned = (body || "").replace(re, " ").replace(/\s+/g, " ").trim();
  if (value == null || value === "") return cleaned;
  // Append novo token no fim (com espaço se houver conteúdo prévio).
  return cleaned.length > 0
    ? `${cleaned} [${token}:${value}]`
    : `[${token}:${value}]`;
}

/**
 * Para o modo "duas imagens" do Madureira, a primeira linha do body
 * é convencionada como `"label1|label2"` (depois dos tokens). Estes
 * helpers manipulam essa linha sem mexer no resto.
 */
export function extractLabels(body: string): { label1: string; label2: string } {
  if (!body) return { label1: "", label2: "" };
  // Tira os tokens primeiro pra não confundir a primeira linha.
  const stripped = body
    .replace(/\[(emoji|deco|img2):[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstLine = stripped.split("\n")[0] || "";
  if (!firstLine.includes("|")) return { label1: "", label2: "" };
  const [l1, l2] = firstLine.split("|").map((s) => s.trim());
  return { label1: l1 || "", label2: l2 || "" };
}

/**
 * Substitui (ou remove) a linha de labels `"label1|label2"`.
 * Se ambas labels são vazias, remove a linha.
 *
 * Preserva tokens e o restante do body intactos.
 */
export function setLabels(
  body: string,
  label1: string,
  label2: string,
): string {
  const raw = body || "";
  // Separa tokens do conteúdo "real".
  const tokens: string[] = [];
  const content = raw.replace(/\[(emoji|deco|img2):[^\]]+\]/g, (m) => {
    tokens.push(m);
    return "";
  });
  const lines = content.split("\n");
  // Detecta se primeira linha é uma linha de labels (contém "|" e nada mais).
  const looksLikeLabels = (lines[0] || "").includes("|");
  if (looksLikeLabels) lines.shift();
  const rest = lines.join("\n").trim();
  const labelsLine =
    label1.trim() || label2.trim()
      ? `${label1.trim()}|${label2.trim()}`
      : "";
  const parts = [labelsLine, rest].filter(Boolean);
  const tokensSuffix = tokens.length > 0 ? " " + tokens.join(" ") : "";
  return (parts.join("\n") + tokensSuffix).trim();
}
