import { useEffect, useRef, useCallback } from "react";

interface UseSmoothScrollOptions {
  behavior?: ScrollBehavior;
  delay?: number;
}

/**
 * Hook para scroll suave automático para o final
 * Adaptado para funcionar com ScrollArea do Radix
 */
export const useSmoothScroll = (
  dependencies: any[],
  options: UseSmoothScrollOptions = {}
) => {
  const { behavior = "smooth", delay = 100 } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  const initialScrollDone = useRef(false);

  // Scroll para o final
  const scrollToBottom = useCallback((immediate = false) => {
    if (!scrollRef.current) return;
    
    // Buscar o viewport do ScrollArea (elemento pai com overflow)
    const viewport = scrollRef.current.closest('[data-radix-scroll-area-viewport]');
    const scrollElement = viewport || scrollRef.current;
    
    if (scrollElement) {
      const scrollBehavior = immediate ? "auto" : behavior;
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: scrollBehavior,
      });
    }
  }, [behavior]);

  // Detectar scroll manual do usuário
  useEffect(() => {
    const handleScroll = () => {
      isUserScrolling.current = true;
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 1000);
    };

    // Encontrar o viewport do ScrollArea
    const viewport = scrollRef.current?.closest('[data-radix-scroll-area-viewport]');
    const scrollElement = viewport || scrollRef.current;

    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll);
      }
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  // Scroll inicial (quando mensagens carregam pela primeira vez)
  useEffect(() => {
    if (!initialScrollDone.current && dependencies[0]?.length > 0) {
      // Delay aumentado para garantir que o DOM está pronto
      setTimeout(() => {
        scrollToBottom(true);
        initialScrollDone.current = true;
      }, 150);
    }
  }, [dependencies, scrollToBottom]);

  // Scroll quando dependências mudam (novas mensagens)
  useEffect(() => {
    if (!isUserScrolling.current && initialScrollDone.current) {
      setTimeout(() => {
        scrollToBottom(false);
      }, delay);
    }
  }, dependencies);

  return { scrollRef, scrollToBottom };
};
