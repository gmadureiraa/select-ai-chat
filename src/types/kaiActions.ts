// ============================================
// kAI Global Assistant - Action Types
// ============================================

import { Message, ProcessStep, MultiAgentStep } from "@/types/chat";

/**
 * Types of actions that kAI can perform
 */
export type KAIActionType =
  | "create_content"        // Create content for a client
  | "ask_about_metrics"     // Answer questions about metrics/performance
  | "upload_metrics"        // Import metrics from CSV files
  | "create_planning_card"  // Create a card in the planning board
  | "upload_to_library"     // Add content to the content library
  | "upload_to_references"  // Add to reference library
  | "analyze_url"           // Analyze a URL (YouTube, article, etc.)
  | "general_chat";         // General conversation

/**
 * Status of an action being executed
 */
export type KAIActionStatus =
  | "idle"
  | "detecting"       // Detecting user intent
  | "analyzing"       // Analyzing files/URLs
  | "previewing"      // Showing preview to user
  | "confirming"      // Waiting for user confirmation
  | "executing"       // Executing the action
  | "completed"       // Action completed successfully
  | "error";          // Action failed

/**
 * Platforms for metrics import
 */
export type MetricsPlatform = 
  | "instagram" 
  | "youtube" 
  | "newsletter" 
  | "twitter" 
  | "linkedin"
  | "unknown";

/**
 * File attachment in kAI chat
 */
export interface KAIFileAttachment {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
  uploadProgress?: number;
}

/**
 * Detected action from user message
 */
export interface DetectedAction {
  type: KAIActionType;
  confidence: number;
  params: {
    clientId?: string;
    clientName?: string;
    format?: string;
    date?: string;
    assignee?: string;
    url?: string;
    platform?: MetricsPlatform;
    title?: string;
    description?: string;
  };
  requiresConfirmation: boolean;
}

/**
 * Pending action waiting for confirmation
 */
export interface PendingAction {
  id: string;
  type: KAIActionType;
  status: KAIActionStatus;
  params: DetectedAction["params"];
  preview?: {
    title: string;
    description: string;
    data?: Record<string, unknown>;
  };
  files?: KAIFileAttachment[];
  createdAt: Date;
}

/**
 * CSV Analysis Result
 */
export interface CSVAnalysisResult {
  platform: MetricsPlatform;
  confidence: number;
  preview: {
    totalRows: number;
    dateRange?: {
      start: string;
      end: string;
    };
    columns: string[];
    sampleData: Record<string, unknown>[];
    metricsDetected: string[];
  };
  errors?: string[];
}

/**
 * URL Analysis Result
 */
export interface URLAnalysisResult {
  type: "youtube" | "article" | "newsletter" | "social" | "unknown";
  title: string;
  description?: string;
  content?: string;
  thumbnailUrl?: string;
  author?: string;
  publishedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * kAI Global State
 */
export interface KAIGlobalState {
  isOpen: boolean;
  messages: Message[];
  isProcessing: boolean;
  currentAction: KAIActionType | null;
  actionStatus: KAIActionStatus;
  pendingAction: PendingAction | null;
  attachedFiles: KAIFileAttachment[];
  selectedClientId: string | null;
  currentStep: ProcessStep;
  multiAgentStep: MultiAgentStep;
}

/**
 * kAI Context value
 */
export interface KAIContextValue extends KAIGlobalState {
  // Panel controls
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  
  // Message handling
  sendMessage: (text: string, files?: File[]) => Promise<void>;
  clearConversation: () => void;
  
  // Action handling
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  
  // File handling
  attachFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  
  // Client selection
  setSelectedClientId: (clientId: string | null) => void;
}

/**
 * Quick suggestion for empty state
 */
export interface KAIQuickSuggestion {
  icon: string;
  label: string;
  prompt: string;
  requiresClient?: boolean;
}

/**
 * Default quick suggestions
 */
export const DEFAULT_KAI_SUGGESTIONS: KAIQuickSuggestion[] = [
  {
    icon: "📝",
    label: "Criar conteúdo",
    prompt: "Quero criar um post para Instagram sobre",
    requiresClient: true,
  },
  {
    icon: "📊",
    label: "Analisar métricas",
    prompt: "Como está o desempenho do meu Instagram?",
    requiresClient: true,
  },
  {
    icon: "📅",
    label: "Criar card",
    prompt: "Criar um card no planejamento para",
    requiresClient: true,
  },
  {
    icon: "🔗",
    label: "Salvar referência",
    prompt: "Adicionar esta URL às referências:",
    requiresClient: true,
  },
];

/**
 * Action patterns for detection
 */
export const ACTION_PATTERNS: Record<KAIActionType, RegExp[]> = {
  create_content: [
    /criar?\s+(um\s+)?(post|conteúdo|carrossel|reels?|stories?|thread)/i,
    /escrever?\s+(um\s+)?(post|texto|legenda|caption)/i,
    /gerar?\s+(um\s+)?(conteúdo|post)/i,
  ],
  ask_about_metrics: [
    /como\s+est[áa]\s+(o\s+)?(desempenho|performance|engajamento)/i,
    /quais?\s+(são\s+)?(as\s+)?métricas/i,
    /análise\s+de\s+(performance|desempenho|métricas)/i,
    /quantos?\s+(seguidores?|likes?|comentários?|views?)/i,
  ],
  upload_metrics: [
    /importar?\s+(métricas?|dados?|csv)/i,
    /upload\s+(de\s+)?(métricas?|csv)/i,
    /carregar?\s+(métricas?|relatório)/i,
  ],
  create_planning_card: [
    /criar?\s+(um\s+)?card\s+(no\s+)?planejamento/i,
    /adicionar?\s+(ao\s+)?planejamento/i,
    /agendar?\s+(um\s+)?(post|conteúdo)/i,
  ],
  upload_to_library: [
    /adicionar?\s+(à|a)\s+biblioteca\s+(de\s+)?conteúdo/i,
    /salvar?\s+(na|em)\s+biblioteca/i,
  ],
  upload_to_references: [
    /adicionar?\s+(às?|a)\s+referências?/i,
    /salvar?\s+(como\s+)?referência/i,
    /guardar?\s+(essa?\s+)?(url|link|referência)/i,
  ],
  analyze_url: [
    /analisar?\s+(essa?|esta?|a)?\s*(url|link|página)/i,
    /extrair?\s+(conteúdo|informações?)\s+(d[ea]|dessa?)/i,
  ],
  general_chat: [], // Fallback, no patterns needed
};
