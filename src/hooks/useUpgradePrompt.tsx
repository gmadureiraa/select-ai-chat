import { createContext, useContext, ReactNode, useCallback } from "react";
import { toast } from "sonner";

/**
 * useUpgradePrompt - Sistema interno Kaleidos
 * 
 * Este provider foi desativado. Em vez de prompts de upgrade,
 * exibe mensagem para contatar o administrador.
 */

type UpgradeReason = 
  | "max_clients" 
  | "max_members" 
  | "enterprise_feature"
  | "automations"
  | "advanced_analytics"
  | "planning_locked"
  | "profiles_locked"
  | "performance_locked"
  | "library_locked"
  | "kai_chat_locked"
  | "custom";

interface UpgradePromptContextType {
  showUpgradePrompt: (reason: UpgradeReason, customMessage?: string) => void;
  hideUpgradePrompt: () => void;
}

const UpgradePromptContext = createContext<UpgradePromptContextType | undefined>(undefined);

export function UpgradePromptProvider({ children }: { children: ReactNode }) {
  // Sistema interno - não há upgrades, apenas permissões por role
  const showUpgradePrompt = useCallback((reason: UpgradeReason, _customMessage?: string) => {
    // Mensagem genérica para sistema interno
    toast.info("Você não tem permissão para esta ação. Entre em contato com o administrador.");
  }, []);

  const hideUpgradePrompt = useCallback(() => {
    // Noop - não há diálogo para esconder
  }, []);

  return (
    <UpgradePromptContext.Provider value={{ showUpgradePrompt, hideUpgradePrompt }}>
      {children}
    </UpgradePromptContext.Provider>
  );
}

export function useUpgradePrompt() {
  const context = useContext(UpgradePromptContext);
  if (!context) {
    throw new Error("useUpgradePrompt must be used within UpgradePromptProvider");
  }
  return context;
}
