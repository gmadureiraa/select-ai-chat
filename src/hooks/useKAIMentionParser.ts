import { useCallback } from "react";

// Types for mentions
export type MentionFormat = 
  | "carrossel" 
  | "post" 
  | "reels" 
  | "stories" 
  | "newsletter" 
  | "thread" 
  | "tweet" 
  | "blog";

export type MentionColumn = 
  | "ideias" 
  | "rascunho" 
  | "revisao" 
  | "aprovado" 
  | "agendado";

export interface ParsedMention {
  type: "card" | "format" | "client" | "column" | "assignee";
  value: string;
  original: string;
}

export interface ParsedCommand {
  action: "create_batch_cards" | "create_single_card" | "unknown";
  quantity: number;
  format: MentionFormat | null;
  clientId: string | null;
  clientName: string | null;
  column: MentionColumn | null;
  assigneeName: string | null;
  schedulingHint: string | null;
  themeHint: string | null;
  dateHint: string | null;
  autoExecute: boolean;
  mentions: ParsedMention[];
  rawMessage: string;
}

// Map of column keywords to column types
const COLUMN_KEYWORDS: Record<string, MentionColumn> = {
  "ideias": "ideias",
  "ideia": "ideias",
  "rascunho": "rascunho",
  "rascunhos": "rascunho",
  "draft": "rascunho",
  "revisao": "revisao",
  "revisão": "revisao",
  "review": "revisao",
  "aprovado": "aprovado",
  "aprovados": "aprovado",
  "approved": "aprovado",
  "agendado": "agendado",
  "agendados": "agendado",
  "scheduled": "agendado",
};

// Map of format keywords to format types
const FORMAT_KEYWORDS: Record<string, MentionFormat> = {
  "carrossel": "carrossel",
  "carrosseis": "carrossel",
  "carousel": "carrossel",
  "post": "post",
  "posts": "post",
  "reels": "reels",
  "reel": "reels",
  "stories": "stories",
  "story": "stories",
  "newsletter": "newsletter",
  "newsletters": "newsletter",
  "thread": "thread",
  "threads": "thread",
  "tweet": "tweet",
  "tweets": "tweet",
  "blog": "blog",
};

export function useKAIMentionParser() {
  const parseMessage = useCallback((message: string, clients: { id: string; name: string }[]): ParsedCommand => {
    const mentions: ParsedMention[] = [];
    let format: MentionFormat | null = null;
    let clientName: string | null = null;
    let clientId: string | null = null;
    let column: MentionColumn | null = null;
    let assigneeName: string | null = null;
    let quantity = 1;
    let action: "create_batch_cards" | "create_single_card" | "unknown" = "unknown";
    
    // Normalize message for easier parsing
    const normalizedMessage = message.toLowerCase();
    
    // 1. Detect quantity pattern: "criar 5 @cards", "5 cards", "criar 10 ideias", "2 @[cards]"
    const quantityPatterns = [
      /criar\s+(\d+)\s*@?\[?cards?\]?/i,
      /(\d+)\s*@?\[?cards?\]?/i,
      /criar\s+(\d+)\s*ideias?/i,
      /gerar\s+(\d+)\s*ideias?/i,
      /(\d+)\s*ideias?\s+de/i,
      /(\d+)\s*conteúdos?/i,
    ];
    
    for (const pattern of quantityPatterns) {
      const match = message.match(pattern);
      if (match) {
        quantity = parseInt(match[1], 10);
        action = quantity > 1 ? "create_batch_cards" : "create_single_card";
        mentions.push({ type: "card", value: `${quantity}`, original: match[0] });
        break;
      }
    }
    
    // 2. Detect @card, @cards, @[card], @[cards] mentions
    const cardMentionPatterns = [
      /@\[cards?\]/i,
      /@cards?/i,
    ];
    
    for (const pattern of cardMentionPatterns) {
      const cardMatch = message.match(pattern);
      if (cardMatch) {
        if (action === "unknown") {
          action = "create_single_card";
        }
        mentions.push({ type: "card", value: "card", original: cardMatch[0] });
        break;
      }
    }
    
    // 3. Detect format @mentions: @carrossel, @[carrossel], @post, @[post], etc.
    // First try bracketed format
    const bracketFormatPattern = /@\[(carrossel|carousel|post|posts|reels?|stories|story|newsletter|newsletters?|threads?|tweets?|blog)\]/gi;
    let formatMatch;
    while ((formatMatch = bracketFormatPattern.exec(message)) !== null) {
      const formatKey = formatMatch[1].toLowerCase();
      const detectedFormat = FORMAT_KEYWORDS[formatKey];
      if (detectedFormat) {
        format = detectedFormat;
        mentions.push({ type: "format", value: detectedFormat, original: formatMatch[0] });
      }
    }
    
    // Then try non-bracketed format if not found
    if (!format) {
      const formatPattern = /@(carrossel|carousel|post|posts|reels?|stories|story|newsletter|newsletters?|threads?|tweets?|blog)/gi;
      while ((formatMatch = formatPattern.exec(message)) !== null) {
        const formatKey = formatMatch[1].toLowerCase();
        const detectedFormat = FORMAT_KEYWORDS[formatKey];
        if (detectedFormat) {
          format = detectedFormat;
          mentions.push({ type: "format", value: detectedFormat, original: formatMatch[0] });
        }
      }
    }
    
    // 4. Also detect format without @ prefix: "de carrossel", "para reels"
    if (!format) {
      for (const [keyword, formatType] of Object.entries(FORMAT_KEYWORDS)) {
        const keywordPattern = new RegExp(`(?:de|para|tipo|formato)\\s+${keyword}`, "i");
        if (keywordPattern.test(message)) {
          format = formatType;
          mentions.push({ type: "format", value: formatType, original: keyword });
          break;
        }
      }
    }
    
    // 5. Detect client @mentions: @[Layla], @[Hugo Silva], @layla, etc.
    // First, try bracketed mentions for client names (can include spaces)
    const bracketClientPattern = /@\[([^\]]+)\]/gi;
    let bracketMatch;
    while ((bracketMatch = bracketClientPattern.exec(message)) !== null) {
      const mentionValue = bracketMatch[1];
      const mentionValueLower = mentionValue.toLowerCase();
      
      // Skip if it's a known keyword (format, card, column)
      if (FORMAT_KEYWORDS[mentionValueLower] || 
          mentionValueLower === "cards" || mentionValueLower === "card" || 
          COLUMN_KEYWORDS[mentionValueLower]) {
        continue;
      }
      
      // Check if it matches a client name
      const matchedClient = clients.find(c => 
        c.name.toLowerCase() === mentionValueLower || 
        c.name.toLowerCase().includes(mentionValueLower) ||
        mentionValueLower.includes(c.name.toLowerCase().split(" ")[0])
      );
      
      if (matchedClient) {
        clientName = matchedClient.name;
        clientId = matchedClient.id;
        mentions.push({ type: "client", value: matchedClient.id, original: bracketMatch[0] });
      }
    }
    
    // Then try non-bracketed @mentions
    if (!clientName) {
      const clientPattern = /@(\w+)/gi;
      let clientMatch;
      while ((clientMatch = clientPattern.exec(message)) !== null) {
        const mentionValue = clientMatch[1].toLowerCase();
        
        // Skip if it's a known keyword (format, card, column)
        if (FORMAT_KEYWORDS[mentionValue] || mentionValue === "cards" || mentionValue === "card" || COLUMN_KEYWORDS[mentionValue]) {
          continue;
        }
        
        // Check if it matches a client name
        const matchedClient = clients.find(c => 
          c.name.toLowerCase() === mentionValue || 
          c.name.toLowerCase().includes(mentionValue) ||
          mentionValue.includes(c.name.toLowerCase().split(" ")[0])
        );
        
        if (matchedClient) {
          clientName = matchedClient.name;
          clientId = matchedClient.id;
          mentions.push({ type: "client", value: matchedClient.id, original: clientMatch[0] });
        }
      }
    }
    
    // 6. Also detect client without @ prefix: "para layla", "cliente layla", "para o cliente x"
    if (!clientName) {
      const clientNamePatterns = [
        /para\s+(?:o\s+)?(?:cliente\s+)?(\w+)/i,
        /cliente\s+(\w+)/i,
        /do\s+(?:cliente\s+)?(\w+)/i,
      ];
      
      for (const pattern of clientNamePatterns) {
        const match = message.match(pattern);
        if (match) {
          const potentialName = match[1].toLowerCase();
          const matchedClient = clients.find(c => 
            c.name.toLowerCase() === potentialName || 
            c.name.toLowerCase().includes(potentialName)
          );
          if (matchedClient) {
            clientName = matchedClient.name;
            clientId = matchedClient.id;
            mentions.push({ type: "client", value: matchedClient.id, original: match[0] });
            break;
          }
        }
      }
    }
    
    // 7. Detect column mentions: "@[ideias]", "em ideias", "em rascunho", "na coluna ideias"
    // First try bracketed format
    for (const [keyword, columnType] of Object.entries(COLUMN_KEYWORDS)) {
      const bracketPattern = new RegExp(`@\\[${keyword}\\]`, "i");
      if (bracketPattern.test(message)) {
        column = columnType;
        mentions.push({ type: "column", value: columnType, original: `@[${keyword}]` });
        break;
      }
    }
    
    // Then try other patterns
    if (!column) {
      for (const [keyword, columnType] of Object.entries(COLUMN_KEYWORDS)) {
        const columnPatterns = [
          new RegExp(`@${keyword}`, "i"),
          new RegExp(`(?:em|na|para)\\s+(?:coluna\\s+)?${keyword}`, "i"),
          new RegExp(`coluna\\s+${keyword}`, "i"),
        ];
        
        for (const pattern of columnPatterns) {
          if (pattern.test(message)) {
            column = columnType;
            mentions.push({ type: "column", value: columnType, original: keyword });
            break;
          }
        }
        if (column) break;
      }
    }
    
    // 8. Detect scheduling hints
    let schedulingHint: string | null = null;
    const schedulingPatterns = [
      /próxim[ao]s?\s+(\d+)?\s*(semanas?|dias?|meses?)/i,
      /para\s+(?:as\s+)?próximas?\s+(semanas?|dias?|meses?)/i,
      /nas?\s+próximas?\s+(\d+)?\s*(semanas?)/i,
      /durante\s+(?:o\s+)?(mês|semana)/i,
    ];
    
    for (const pattern of schedulingPatterns) {
      const match = message.match(pattern);
      if (match) {
        schedulingHint = match[0];
        break;
      }
    }
    
    // 9. Detect specific date hints
    let dateHint: string | null = null;
    const datePatterns = [
      /(?:para\s+)?(?:o\s+)?dia\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i,
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
      /dia\s+(\d{1,2})\s+de\s+(\w+)/i,
    ];
    
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        dateHint = match[0];
        break;
      }
    }
    
    // 10. Detect theme/topic hints
    let themeHint: string | null = null;
    const themePatterns = [
      /sobre\s+(.+?)(?:\s+para|\s+nas?|\s+em|\s+@|$)/i,
      /tema\s+(.+?)(?:\s+para|\s+nas?|\s+em|\s+@|$)/i,
      /de\s+conteúdo\s+sobre\s+(.+?)(?:\s+para|\s+@|$)/i,
    ];
    
    for (const pattern of themePatterns) {
      const match = message.match(pattern);
      if (match) {
        themeHint = match[1].trim();
        break;
      }
    }
    
    // 11. Determine if auto-execute (safe action)
    const autoExecute = action !== "unknown" && (
      action === "create_batch_cards" || 
      action === "create_single_card"
    );
    
    // 12. If we have quantity > 0 but action still unknown, infer it
    if (quantity > 0 && action === "unknown" && (format || clientName || column)) {
      action = quantity > 1 ? "create_batch_cards" : "create_single_card";
    }
    
    return {
      action,
      quantity,
      format,
      clientId,
      clientName,
      column,
      assigneeName,
      schedulingHint,
      themeHint,
      dateHint,
      autoExecute,
      mentions,
      rawMessage: message,
    };
  }, []);
  
  // Check if a message is a planning command
  const isPlanningCommand = useCallback((message: string): boolean => {
    const planningIndicators = [
      /criar\s+\d*\s*@?\[?cards?\]?/i,
      /@\[?cards?\]?/i,
      /criar\s+\d+\s*ideias?/i,
      /gerar\s+\d+\s*ideias?/i,
      /planejamento/i,
      /no\s+planejamento/i,
      /para\s+(?:o\s+)?planejamento/i,
      /criar\s+\d+\s*conteúdos?/i,
    ];
    
    return planningIndicators.some(pattern => pattern.test(message));
  }, []);
  
  return {
    parseMessage,
    isPlanningCommand,
  };
}
