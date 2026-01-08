import { Citation } from "@/components/chat/CitationChip";

export interface MessagePayload {
  citations?: Citation[];
  messageId?: string;
  [key: string]: unknown;
}

export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  image_urls?: string[] | null;
  payload?: MessagePayload | null;
  created_at?: string;
  conversation_id?: string;
  isGeneratedImage?: boolean; // Flag para identificar imagens geradas por IA
}

export interface Client {
  id: string;
  name: string;
  description?: string;
  context_notes?: string;
  social_media?: Record<string, string>;
  tags?: Record<string, string>;
  function_templates?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  client_id: string;
  title: string;
  model: string;
  template_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Website {
  id: string;
  client_id: string;
  url: string;
  scraped_content?: string;
  scraped_markdown?: string;
  last_scraped_at?: string;
  created_at: string;
}

export interface Document {
  id: string;
  client_id: string;
  name: string;
  file_path: string;
  file_type: string;
  extracted_content?: string | null;
  created_at: string;
}

export type ProcessStep = 
  | "analyzing" 
  | "analyzing_library" 
  | "reviewing" 
  | "creating" 
  | "selecting" 
  | "generating_image"
  | "multi_agent" // Pipeline multi-agente
  | null;

export type MultiAgentStep = 
  | "researcher" 
  | "writer" 
  | "editor" 
  | "reviewer" 
  | "complete" 
  | "error" 
  | null;

export interface SelectedMaterial {
  id: string;
  type: 'content_library' | 'document' | 'reference_library';
  category: string;
  title: string;
  reason?: string;
}

export interface WorkflowState {
  currentStep: ProcessStep;
  selectedMaterials: SelectedMaterial[];
  patternAnalysis?: string;
  reasoning?: string;
  strategy?: string;
}

export interface ChatError {
  message: string;
  type: "network" | "api" | "validation" | "unknown";
  statusCode?: number;
}

// Função para detectar pedidos de geração de imagem
// Suporta comandos explícitos @ e linguagem natural
export function detectImageGenerationRequest(message: string): { 
  isImageRequest: boolean; 
  prompt: string;
  isContextual: boolean; // true quando o usuário quer imagem "disso" (do conteúdo anterior)
} {
  // Comandos explícitos @ (prioridade máxima)
  const explicitImageCommands = [
    /@gerar[\s_-]?imagem/i,
    /@imagem/i,
    /@generate[\s_-]?image/i,
    /@image/i,
  ];

  // Padrões de linguagem natural para geração de imagem
  const naturalImagePatterns = [
    /gera(r)? (uma? )?imagem/i,
    /cria(r)? (uma? )?imagem/i,
    /faz(er)? (uma? )?(arte|imagem|visual)/i,
    /gera(r)? (uma? )?(arte|visual)/i,
    /(quero|preciso) (de )?(uma? )?(imagem|arte|visual)/i,
    /produz(ir)? (uma? )?imagem/i,
    /me (faz|gera|cria) (uma? )?imagem/i,
  ];

  // Padrões que indicam referência ao conteúdo anterior
  const contextualPatterns = [
    /(imagem|arte|visual) (pra |para )?(isso|esse|essa|este|esta)/i,
    /(imagem|arte|visual) (do|da|desse|dessa) (conteúdo|post|texto|ideia)/i,
    /gera(r)? imagem (pra|para) (isso|esse|essa)/i,
    /(faz|cria|gera) (uma? )?(imagem|arte) (disso|desse|dessa)/i,
    /imagem (baseada?|inspirada?) (no|na|nisso|nesse|nessa)/i,
  ];

  const isExplicitCommand = explicitImageCommands.some(pattern => pattern.test(message));
  const isNaturalRequest = naturalImagePatterns.some(pattern => pattern.test(message));
  const isContextual = contextualPatterns.some(pattern => pattern.test(message));

  const isImageRequest = isExplicitCommand || isNaturalRequest;
  
  // Extrair o prompt removendo os comandos
  let prompt = message;
  if (isImageRequest) {
    prompt = message
      // Remover comandos @
      .replace(/@gerar[\s_-]?imagem\s*/gi, '')
      .replace(/@imagem\s*/gi, '')
      .replace(/@generate[\s_-]?image\s*/gi, '')
      .replace(/@image\s*/gi, '')
      // Remover padrões naturais comuns
      .replace(/gera(r)? (uma? )?imagem\s*/gi, '')
      .replace(/cria(r)? (uma? )?imagem\s*/gi, '')
      .replace(/faz(er)? (uma? )?(arte|imagem|visual)\s*/gi, '')
      .replace(/me (faz|gera|cria) (uma? )?imagem\s*/gi, '')
      .replace(/(quero|preciso) (de )?(uma? )?(imagem|arte|visual)\s*/gi, '')
      // Limpar referências contextuais
      .replace(/(pra |para )?(isso|esse|essa|este|esta|disso|desse|dessa)/gi, '')
      .replace(/(do|da) (conteúdo|post|texto|ideia)/gi, '')
      .trim();
  }

  return { isImageRequest, prompt, isContextual };
}

// Função para extrair o último conteúdo relevante das mensagens
export function extractLastRelevantContent(messages: Message[]): string | null {
  // Procurar de trás para frente por conteúdo substantivo do assistente
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.content) {
      // Ignorar mensagens muito curtas ou que são apenas confirmações
      if (msg.content.length > 100) {
        return msg.content;
      }
    }
  }
  return null;
}
