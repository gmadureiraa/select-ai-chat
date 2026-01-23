export function sanitizeReferenceText(input: string): string {
  let text = (input || "").toString();
  if (!text.trim()) return "";

  // Remove markdown images: ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^\)]*\)/g, "");

  // Remove bare image URLs (common in newsletters)
  text = text.replace(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(\?\S*)?/gi, "");

  // Collapse URLs into domain hints
  text = text.replace(/https?:\/\/[^\s)]+/g, (m) => {
    try {
      const u = new URL(m);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  });

  // Normalize whitespace
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

export function clampText(text: string, maxChars: number): string {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[...conteúdo truncado para caber no contexto...]`;
}

