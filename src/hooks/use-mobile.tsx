import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// 2026-05-16 — fix audit P1-1: antes inicializava com `undefined` e retornava
// `!!isMobile` (= false no first render). Em viewport 375px isso causava
// FOUC: Kai.tsx montava KaiSidebar desktop, useEffect rodava, descobria
// que é mobile, troca pra MobileHeader+MobileBottomNav. Flash visível.
//
// Agora lê window.innerWidth síncrono no init (lazy initial state). Em SSR
// (sem window) inicia como `false` por safety, mas no client o primeiro
// render já vê o tamanho real.
function getInitialIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialIsMobile);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // Re-sync caso o valor inicial tenha mudado entre lazy init e mount
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
