import { useContext } from "react";
import { GlobalKAIContext } from "@/contexts/GlobalKAIContext";
import { KAIContextValue } from "@/types/kaiActions";

/**
 * Hook to access the global kAI assistant context.
 * Must be used within a GlobalKAIProvider.
 */
export function useGlobalKAI(): KAIContextValue {
  const context = useContext(GlobalKAIContext);
  if (!context) {
    throw new Error("useGlobalKAI must be used within a GlobalKAIProvider");
  }
  return context;
}

// Re-export for convenience
export type { KAIContextValue } from "@/types/kaiActions";
