export interface Mention {
  title: string;
  type: 'content' | 'reference';
  id: string;
  start: number;
  end: number;
  fullMatch: string;
}

// Regex para detectar menções no formato @[título](tipo:id)
const MENTION_REGEX = /@\[([^\]]+)\]\((content|reference):([a-f0-9-]+)\)/g;

/**
 * Extrai todas as menções de um texto
 */
export function parseMentions(text: string): Mention[] {
  if (!text) return [];
  
  const mentions: Mention[] = [];
  let match;
  
  // Reset regex lastIndex
  MENTION_REGEX.lastIndex = 0;
  
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    mentions.push({
      title: match[1],
      type: match[2] as 'content' | 'reference',
      id: match[3],
      start: match.index,
      end: match.index + match[0].length,
      fullMatch: match[0]
    });
  }
  
  return mentions;
}

/**
 * Cria uma string de menção no formato correto
 */
export function createMentionString(title: string, type: 'content' | 'reference', id: string): string {
  return `@[${title}](${type}:${id})`;
}

/**
 * Remove uma menção específica do texto
 */
export function removeMention(text: string, mentionId: string): string {
  const regex = new RegExp(`@\\[[^\\]]+\\]\\((content|reference):${mentionId}\\)`, 'g');
  return text.replace(regex, '').trim();
}

/**
 * Verifica se o cursor está dentro de uma menção
 */
export function isCursorInMention(text: string, cursorPosition: number): Mention | null {
  const mentions = parseMentions(text);
  return mentions.find(m => cursorPosition > m.start && cursorPosition <= m.end) || null;
}

/**
 * Obtém o texto limpo (sem formatação de menção) para exibição
 */
export function getPlainText(text: string): string {
  if (!text) return '';
  return text.replace(MENTION_REGEX, '@$1');
}
