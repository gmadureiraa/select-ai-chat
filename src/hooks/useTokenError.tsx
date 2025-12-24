import { useState, useCallback, useRef, useEffect, createContext, useContext, ReactNode } from "react";
import { useTokens } from "./useTokens";
import { UpgradePlanDialog } from "@/components/settings/UpgradePlanDialog";

interface TokenErrorContextType {
  handleTokenError: (error: any, statusCode?: number) => Promise<boolean>;
  showUpgradeDialog: () => void;
  closeUpgradeDialog: () => void;
  checkResponse: (response: Response) => Promise<boolean>;
}

const TokenErrorContext = createContext<TokenErrorContextType | null>(null);

export const useTokenError = () => {
  const context = useContext(TokenErrorContext);
  if (!context) {
    // Return a default implementation if used outside provider
    return {
      handleTokenError: async () => false,
      showUpgradeDialog: () => {},
      closeUpgradeDialog: () => {},
      checkResponse: async () => true,
    };
  }
  return context;
};

interface TokenErrorProviderProps {
  children: ReactNode;
}

export const TokenErrorProvider = ({ children }: TokenErrorProviderProps) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { refetch } = useTokens();
  const isRefetchingRef = useRef(false);

  const handleTokenError = useCallback(async (error: any, statusCode?: number) => {
    // Check if it's a 402 (Payment Required) error
    const is402Error = statusCode === 402 || 
      error?.status === 402 || 
      error?.code === "TOKENS_EXHAUSTED" ||
      error?.error === "insufficient_tokens";

    if (is402Error) {
      console.log("[useTokenError] Token error detected, showing upgrade modal");
      
      // Refetch token balance (debounced)
      if (!isRefetchingRef.current) {
        isRefetchingRef.current = true;
        try {
          await refetch();
        } finally {
          setTimeout(() => {
            isRefetchingRef.current = false;
          }, 2000);
        }
      }
      
      setShowUpgradeModal(true);
      return true;
    }
    
    return false;
  }, [refetch]);

  const showUpgradeDialog = useCallback(() => {
    setShowUpgradeModal(true);
  }, []);

  const closeUpgradeDialog = useCallback(() => {
    setShowUpgradeModal(false);
  }, []);

  const checkResponse = useCallback(async (response: Response) => {
    if (response.status === 402) {
      const data = await response.json().catch(() => ({}));
      await handleTokenError(data, 402);
      return false;
    }
    return true;
  }, [handleTokenError]);

  const value: TokenErrorContextType = {
    handleTokenError,
    showUpgradeDialog,
    closeUpgradeDialog,
    checkResponse,
  };

  return (
    <TokenErrorContext.Provider value={value}>
      {children}
      <UpgradePlanDialog 
        open={showUpgradeModal} 
        onOpenChange={(open) => {
          if (!open) closeUpgradeDialog();
        }} 
      />
    </TokenErrorContext.Provider>
  );
};
