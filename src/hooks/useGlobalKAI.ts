import { useContext } from "react";
import { GlobalKAIContext } from "@/contexts/GlobalKAIContext";

/**
 * Hook to access the global kAI assistant context.
 * Must be used within a GlobalKAIProvider.
 */
export function useGlobalKAI() {
  const context = useContext(GlobalKAIContext);
  if (!context) {
    throw new Error("useGlobalKAI must be used within a GlobalKAIProvider");
  }
  return context;
}
