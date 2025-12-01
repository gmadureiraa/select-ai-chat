export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  image_urls?: string[] | null;
  created_at?: string;
  conversation_id?: string;
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
  created_at: string;
}

export type ProcessStep = "analyzing" | "analyzing_library" | "reviewing" | "creating" | "selecting" | null;

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
