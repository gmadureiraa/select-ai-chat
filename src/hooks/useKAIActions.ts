import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  KAIActionType,
  DetectedAction,
  ACTION_PATTERNS,
  KAIFileAttachment,
} from "@/types/kaiActions";

interface UseKAIActionsReturn {
  detectAction: (
    message: string,
    files?: KAIFileAttachment[],
    context?: { clientId?: string; currentPage?: string }
  ) => Promise<DetectedAction>;
  isDetecting: boolean;
}

/**
 * Hook for detecting user intentions and extracting action parameters
 */
export function useKAIActions(): UseKAIActionsReturn {
  const [isDetecting, setIsDetecting] = useState(false);

  /**
   * Detect action from message using regex patterns first, then AI fallback
   */
  const detectAction = useCallback(
    async (
      message: string,
      files?: KAIFileAttachment[],
      context?: { clientId?: string; currentPage?: string }
    ): Promise<DetectedAction> => {
      setIsDetecting(true);

      try {
        // First, try pattern-based detection (faster)
        const patternResult = detectFromPatterns(message, files);
        if (patternResult.confidence >= 0.8) {
          return patternResult;
        }

        // If pattern detection is not confident enough, use AI
        const aiResult = await detectFromAI(message, files, context);
        
        // Merge results, preferring AI if more confident
        if (aiResult.confidence > patternResult.confidence) {
          return aiResult;
        }

        return patternResult;
      } catch (error) {
        console.error("Error detecting action:", error);
        // Fallback to general chat
        return {
          type: "general_chat",
          confidence: 1,
          params: {},
          requiresConfirmation: false,
        };
      } finally {
        setIsDetecting(false);
      }
    },
    []
  );

  return {
    detectAction,
    isDetecting,
  };
}

/**
 * Pattern-based action detection (fast, local)
 */
function detectFromPatterns(
  message: string,
  files?: KAIFileAttachment[]
): DetectedAction {
  const lowerMessage = message.toLowerCase();

  // Check for file-based actions first
  if (files && files.length > 0) {
    const hasCSV = files.some(
      (f) => f.type === "text/csv" || f.name.endsWith(".csv")
    );
    if (hasCSV) {
      return {
        type: "upload_metrics",
        confidence: 0.9,
        params: {},
        requiresConfirmation: true,
      };
    }
  }

  // Check for URL patterns
  const urlMatch = message.match(
    /https?:\/\/[^\s]+/i
  );
  if (urlMatch) {
    // Check if it's an upload to references request
    for (const pattern of ACTION_PATTERNS.upload_to_references) {
      if (pattern.test(lowerMessage)) {
        return {
          type: "upload_to_references",
          confidence: 0.85,
          params: { url: urlMatch[0] },
          requiresConfirmation: true,
        };
      }
    }

    // Check if it's an upload to library request
    for (const pattern of ACTION_PATTERNS.upload_to_library) {
      if (pattern.test(lowerMessage)) {
        return {
          type: "upload_to_library",
          confidence: 0.85,
          params: { url: urlMatch[0] },
          requiresConfirmation: true,
        };
      }
    }

    // Default URL analysis
    return {
      type: "analyze_url",
      confidence: 0.7,
      params: { url: urlMatch[0] },
      requiresConfirmation: false,
    };
  }

  // Check each action type's patterns
  for (const [actionType, patterns] of Object.entries(ACTION_PATTERNS)) {
    if (actionType === "general_chat") continue;

    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        const params = extractParams(message, actionType as KAIActionType);
        return {
          type: actionType as KAIActionType,
          confidence: 0.8,
          params,
          requiresConfirmation: requiresConfirmation(actionType as KAIActionType),
        };
      }
    }
  }

  // Default to general chat
  return {
    type: "general_chat",
    confidence: 1,
    params: {},
    requiresConfirmation: false,
  };
}

/**
 * AI-based action detection (more accurate, slower)
 */
async function detectFromAI(
  message: string,
  files?: KAIFileAttachment[],
  context?: { clientId?: string; currentPage?: string }
): Promise<DetectedAction> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "analyze-kai-intention",
      {
        body: {
          message,
          files: files?.map((f) => ({ name: f.name, type: f.type })),
          context,
        },
      }
    );

    if (error) throw error;

    return {
      type: data.actionType || "general_chat",
      confidence: data.confidence || 0.5,
      params: data.extractedParams || {},
      requiresConfirmation: data.requiresConfirmation ?? false,
    };
  } catch (error) {
    console.error("AI detection failed:", error);
    return {
      type: "general_chat",
      confidence: 0.5,
      params: {},
      requiresConfirmation: false,
    };
  }
}

/**
 * Extract parameters from message based on action type
 */
function extractParams(
  message: string,
  actionType: KAIActionType
): DetectedAction["params"] {
  const params: DetectedAction["params"] = {};

  // Extract client name mentions
  const clientMatch = message.match(
    /(?:para|do|da|cliente|client)\s+["']?([^"'\n,]+)["']?/i
  );
  if (clientMatch) {
    params.clientName = clientMatch[1].trim();
  }

  // Extract format mentions
  const formatPatterns: Record<string, RegExp> = {
    post: /\b(post|publicação)\b/i,
    carrossel: /\b(carrossel|carousel)\b/i,
    reels: /\b(reels?|vídeo curto)\b/i,
    stories: /\b(stories?|story)\b/i,
    thread: /\b(thread)\b/i,
  };

  for (const [format, pattern] of Object.entries(formatPatterns)) {
    if (pattern.test(message)) {
      params.format = format;
      break;
    }
  }

  // Extract date mentions
  const datePatterns = [
    /(?:para|em|dia)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /(?:para|em)\s+(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo)/i,
  ];

  for (const pattern of datePatterns) {
    const match = message.match(pattern);
    if (match) {
      params.date = match[1];
      break;
    }
  }

  // Extract assignee mentions
  const assigneeMatch = message.match(
    /(?:responsável|atribuir|para)\s+@?([A-Za-zÀ-ú]+)/i
  );
  if (assigneeMatch) {
    params.assignee = assigneeMatch[1];
  }

  // Extract URL
  const urlMatch = message.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    params.url = urlMatch[0];
  }

  return params;
}

/**
 * Determine if action type requires user confirmation
 */
function requiresConfirmation(actionType: KAIActionType): boolean {
  const confirmationRequired: KAIActionType[] = [
    "upload_metrics",
    "create_planning_card",
    "upload_to_library",
    "upload_to_references",
  ];

  return confirmationRequired.includes(actionType);
}

export type { DetectedAction };
