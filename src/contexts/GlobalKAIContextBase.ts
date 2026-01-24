import { createContext } from "react";

import type { Message, ProcessStep, MultiAgentStep } from "@/types/chat";
import type { KAIActionStatus, KAIFileAttachment, PendingAction } from "@/types/kaiActions";

export type GlobalKAIChatMode = "ideas" | "content" | "performance" | "free_chat";

// Simple citation type for the new system
export interface SimpleCitationType {
  id: string;
  type: "content" | "reference" | "format";
  title: string;
}

// Library item types (matching useClientChat return types)
export interface ContentLibraryItem {
  id: string;
  title: string;
  content_type: string;
  content?: string;
}

export interface ReferenceLibraryItem {
  id: string;
  title: string;
  reference_type: string;
  content?: string;
}

export interface AssigneeItem {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

export interface ClientItem {
  id: string;
  name: string;
  avatar_url?: string;
}

// Extended context value with all features
export interface GlobalKAIContextValue {
  // Panel state
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  // Chat state
  messages: Message[];
  isProcessing: boolean;
  currentStep?: ProcessStep;
  multiAgentStep?: MultiAgentStep;
  multiAgentDetails?: Record<string, string>;
  conversationId?: string | null;

  // Libraries
  contentLibrary: ContentLibraryItem[];
  referenceLibrary: ReferenceLibraryItem[];

  // Workspace data
  assignees: AssigneeItem[];
  clients: ClientItem[];

  // Client selection
  selectedClientId: string | null;
  setSelectedClientId: (clientId: string | null) => void;

  // Message handling
  sendMessage: (text: string, files?: File[], citations?: SimpleCitationType[]) => Promise<void>;
  clearConversation: () => void;
  regenerateLastMessage: () => Promise<void>;
  cancelRequest?: () => void;

  // Action handling
  actionStatus: KAIActionStatus;
  pendingAction: PendingAction | null;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;

  // File handling
  attachedFiles: KAIFileAttachment[];
  attachFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;

  // Mode selection
  chatMode: GlobalKAIChatMode;
  setChatMode: (mode: GlobalKAIChatMode) => void;

  // Workflow state
  isIdeaMode: boolean;
  isFreeChatMode: boolean;
}

// Singleton context instance (kept in a tiny module to avoid circular deps / HMR duplication)
export const GlobalKAIContext = createContext<GlobalKAIContextValue | null>(null);
