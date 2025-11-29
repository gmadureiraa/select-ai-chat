import { useState, useCallback } from "react";

interface UseCopyToClipboardReturn {
  isCopied: boolean;
  copyToClipboard: (text: string) => Promise<boolean>;
  reset: () => void;
}

export const useCopyToClipboard = (
  timeout: number = 2000
): UseCopyToClipboardReturn => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      if (!navigator?.clipboard) {
        console.warn("Clipboard API não suportado");
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);

        // Reset após timeout
        setTimeout(() => {
          setIsCopied(false);
        }, timeout);

        return true;
      } catch (error) {
        console.error("Erro ao copiar:", error);
        setIsCopied(false);
        return false;
      }
    },
    [timeout]
  );

  const reset = useCallback(() => {
    setIsCopied(false);
  }, []);

  return { isCopied, copyToClipboard, reset };
};
