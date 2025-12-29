import { Citation } from "@/components/chat/CitationChip";

export interface MessagePayload {
  citations?: Citation[];
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
export function detectImageGenerationRequest(message: string): { isImageRequest: boolean; prompt: string } {
  const imagePatterns = [
    /(?:gere|crie|faça|desenhe|produza|elabore|monte)\s+(?:uma?\s+)?(?:imagem|ilustração|arte|visual|design|banner|thumbnail|capa|foto|picture)/i,
    /(?:quero|preciso|me\s+(?:faz|faça))\s+(?:uma?\s+)?(?:imagem|ilustração|arte|visual|design|banner)/i,
    /(?:criar|gerar)\s+(?:uma?\s+)?(?:imagem|ilustração|arte|visual)/i,
    /visualize|ilustre|represente\s+visualmente/i,
    /(?:make|create|generate|draw)\s+(?:an?\s+)?(?:image|illustration|picture|art|visual)/i,
  ];

  const isImageRequest = imagePatterns.some(pattern => pattern.test(message));
  
  // Extrair o prompt removendo os termos de comando
  let prompt = message;
  if (isImageRequest) {
    prompt = message
      .replace(/(?:gere|crie|faça|desenhe|produza|elabore|monte|quero|preciso|me\s+(?:faz|faça)|criar|gerar|visualize|ilustre|represente\s+visualmente|make|create|generate|draw)\s+(?:uma?\s+)?(?:imagem|ilustração|arte|visual|design|banner|thumbnail|capa|foto|picture|an?\s+image|illustration|picture|art|visual)?\s*/gi, '')
      .trim();
  }

  return { isImageRequest, prompt };
}
