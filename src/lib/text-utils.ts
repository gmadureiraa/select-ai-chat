/**
 * Centralized text utility functions for content preview and display
 */

/**
 * Clean markdown and page separators from content for preview
 */
export function cleanContentForPreview(text: string): string {
  if (!text) return "";
  return text
    .replace(/---\s*(PÁGINA|SLIDE|PAGE)\s*\d+\s*---/gi, "") // Remove legacy page separators
    .replace(/##\s*📱\s*Slide\s*\d+/gi, "") // Remove new slide headers
    .replace(/##\s*📄\s*Página\s*\d+/gi, "") // Remove new page headers
    .replace(/Página\s*\d+:/gi, "") // Remove "Página X:" format
    .replace(/VISUAL RECOMENDADO:[^\n]*/gi, "") // Remove visual recommendations
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold markdown
    .replace(/\*([^*]+)\*/g, "$1") // Remove italic markdown
    .replace(/#{1,6}\s/g, "") // Remove headers
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // Remove images
    .replace(/^\s*[-*+]\s/gm, "") // Remove list markers
    .replace(/^\s*\d+\.\s/gm, "") // Remove numbered list markers
    .replace(/---/g, "") // Remove horizontal rules
    .replace(/\n{2,}/g, " ") // Replace multiple newlines with space
    .replace(/\n/g, " ") // Replace single newlines with space
    .trim();
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Strip all markdown formatting from text
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/^\s*[-*+]\s/gm, "")
    .replace(/^\s*\d+\.\s/gm, "")
    .replace(/^\s*>/gm, "")
    .replace(/---/g, "")
    .trim();
}

/**
 * Extract first paragraph from content
 */
export function extractFirstParagraph(text: string, maxLength = 200): string {
  if (!text) return "";
  const cleaned = stripMarkdown(text);
  const firstParagraph = cleaned.split(/\n\n/)[0] || cleaned;
  return truncateText(firstParagraph, maxLength);
}
