import { useEffect, useRef } from "react";

interface UseSmoothScrollOptions {
  behavior?: ScrollBehavior;
  delay?: number;
}

/**
 * Hook para scroll suave automático para o final
 */
export const useSmoothScroll = (
  dependencies: any[],
  options: UseSmoothScrollOptions = {}
) => {
  const { behavior = "smooth", delay = 100 } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Detectar quando usuário está fazendo scroll manual
    const handleScroll = () => {
      isUserScrolling.current = true;
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      scrollTimeout.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 1000);
    };

    const scrollElement = scrollRef.current;
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

  useEffect(() => {
    // Só fazer scroll automático se usuário não estiver fazendo scroll manual
    if (!isUserScrolling.current && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior,
        });
      }, delay);
    }
  }, dependencies);

  return scrollRef;
};
