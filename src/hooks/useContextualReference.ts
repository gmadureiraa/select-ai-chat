import { useMemo } from "react";
import { detectContentTypeSimple } from "@/lib/contentTypeDetection";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ContextualReferenceResult {
  hasContextualReference: boolean;
  referenceType: "idea" | "content" | "analysis" | "general" | null;
  enrichedPrompt: string;
}

// Padrões que indicam referência ao contexto anterior
const contextualPatterns = [
  // Referências diretas
  /\b(isso|isto|essa?|este?|aquilo)\b/i,
  /\b(o que (você )?falou|o que (você )?disse|o que (você )?criou)\b/i,
  /\b(a (última )?ideia|essa ideia|a ideia anterior)\b/i,
  /\b(o (último )?conteúdo|esse conteúdo|o conteúdo anterior)\b/i,
  /\b(a (última )?sugestão|essa sugestão)\b/i,
  
  // Ações sobre contexto
  /\b(desenvolv[ae]|expan[de]a?|aprofund[ae]|detal[he]a?)\s+(isso|isto|essa?|mais)\b/i,
  /\b(cri[ae]|faz|gera?)\s+(um )?(post|conteúdo|texto|imagem|arte)\s+(sobre|para|com|disso|dessa?)\b/i,
  /\b(transforma?|convert[ae])\s+(isso|em)\b/i,
  /\b(usa?|utiliz[ae])\s+(isso|essa?|o que)\b/i,
  /\b(baseado|com base)\s+(n[oa]|em)\s+(que|isso)\b/i,
  
  // Referências numéricas
  /\b(a |o )?(primeira?|segund[oa]|terceir[oa]|quart[oa]|quint[oa]|últim[oa])\s*(ideia|sugestão|opção|item)?\b/i,
  /\b(opção|item|número)\s*\d+\b/i,
];

// Extrair item específico se referência numérica
function extractSpecificItem(userMessage: string, assistantContent: string): string | null {
  // Detectar referência numérica
  const numericMatch = userMessage.match(/\b(primeira?|segund[oa]|terceir[oa]|quart[oa]|quint[oa]|últim[oa]|(\d+))\b/i);
  
  if (!numericMatch) return null;
  
  const numMap: Record<string, number> = {
    "primeira": 1, "primeiro": 1,
    "segunda": 2, "segundo": 2,
    "terceira": 3, "terceiro": 3,
    "quarta": 4, "quarto": 4,
    "quinta": 5, "quinto": 5,
  };
  
  let itemNumber: number;
  
  if (numericMatch[2]) {
    itemNumber = parseInt(numericMatch[2]);
  } else if (numericMatch[1].toLowerCase() === "última" || numericMatch[1].toLowerCase() === "último") {
    // Pegar último item
    const items = assistantContent.match(/(?:^|\n)\s*(?:\d+\.|•|-)\s*(.+?)(?=\n|$)/g);
    itemNumber = items ? items.length : 1;
  } else {
    itemNumber = numMap[numericMatch[1].toLowerCase()] || 1;
  }
  
  // Extrair item da lista
  const listPattern = new RegExp(`(?:^|\\n)\\s*(?:${itemNumber}\\.|•|-)\\s*(.+?)(?=\\n|$)`, 'm');
  const match = assistantContent.match(listPattern);
  
  return match ? match[1].trim() : null;
}

export function useContextualReference(
  messages: Message[],
  currentUserMessage: string
): ContextualReferenceResult {
  return useMemo(() => {
    // Verificar se há referência contextual
    const hasReference = contextualPatterns.some(pattern => 
      pattern.test(currentUserMessage)
    );
    
    if (!hasReference || messages.length === 0) {
      return {
        hasContextualReference: false,
        referenceType: null,
        enrichedPrompt: currentUserMessage,
      };
    }
    
    // Encontrar última mensagem relevante do assistente
    const lastAssistantMessage = [...messages]
      .reverse()
      .find(m => m.role === "assistant" && m.content.length > 50);
    
    if (!lastAssistantMessage) {
      return {
        hasContextualReference: false,
        referenceType: null,
        enrichedPrompt: currentUserMessage,
      };
    }
    
    const referenceType = detectContentTypeSimple(lastAssistantMessage.content);
    
    // Tentar extrair item específico
    const specificItem = extractSpecificItem(currentUserMessage, lastAssistantMessage.content);
    
    // Construir prompt enriquecido
    let contextToAdd: string;
    
    if (specificItem) {
      contextToAdd = `\n\n[Contexto - Item selecionado pelo usuário: "${specificItem}"]`;
    } else {
      // Resumir o conteúdo se muito longo
      const contentPreview = lastAssistantMessage.content.length > 1000
        ? lastAssistantMessage.content.substring(0, 1000) + "..."
        : lastAssistantMessage.content;
      
      contextToAdd = `\n\n[Contexto - Última resposta do assistente que o usuário está referenciando:\n${contentPreview}]`;
    }
    
    return {
      hasContextualReference: true,
      referenceType,
      enrichedPrompt: currentUserMessage + contextToAdd,
    };
  }, [messages, currentUserMessage]);
}

// Hook simplificado para uso direto
export function detectContextualReference(
  messages: Message[],
  userMessage: string
): { hasReference: boolean; enrichedPrompt: string } {
  const hasReference = contextualPatterns.some(pattern => 
    pattern.test(userMessage)
  );
  
  if (!hasReference || messages.length === 0) {
    return { hasReference: false, enrichedPrompt: userMessage };
  }
  
  const lastAssistantMessage = [...messages]
    .reverse()
    .find(m => m.role === "assistant" && m.content.length > 50);
  
  if (!lastAssistantMessage) {
    return { hasReference: false, enrichedPrompt: userMessage };
  }
  
  const specificItem = extractSpecificItem(userMessage, lastAssistantMessage.content);
  
  let contextToAdd: string;
  if (specificItem) {
    contextToAdd = `\n\n[Contexto - Item selecionado: "${specificItem}"]`;
  } else {
    const preview = lastAssistantMessage.content.length > 800
      ? lastAssistantMessage.content.substring(0, 800) + "..."
      : lastAssistantMessage.content;
    contextToAdd = `\n\n[Contexto da conversa anterior:\n${preview}]`;
  }
  
  return {
    hasReference: true,
    enrichedPrompt: userMessage + contextToAdd,
  };
}
