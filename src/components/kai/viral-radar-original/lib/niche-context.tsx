/**
 * Niche context — global state do nicho ativo (compartilhado entre páginas).
 *
 * Cópia do `lib/niche-context.tsx` do standalone, sem `"use client"`
 * (Vite não usa essa diretiva).
 *
 * Persiste em localStorage. Dispara custom event 'niche-changed'.
 */

import { createContext, useContext, useState } from "react";
import { DEFAULT_NICHE, NICHES, getNiche, type Niche } from "./niches";

const STORAGE_KEY = "rdv_active_niche";

interface NicheContextValue {
  active: Niche;
  setActive: (id: string) => void;
  niches: Niche[];
}

const NicheContext = createContext<NicheContextValue | null>(null);

export function NicheProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_NICHE.id;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && getNiche(stored)) return stored;
    } catch {
      /* localStorage bloqueado */
    }
    return DEFAULT_NICHE.id;
  });

  const setActive = (id: string) => {
    if (!getNiche(id)) return;
    setActiveId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* noop */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("niche-changed", { detail: { niche: id } }));
    }
  };

  const active = getNiche(activeId) ?? DEFAULT_NICHE;

  return (
    <NicheContext.Provider value={{ active, setActive, niches: NICHES }}>
      {children}
    </NicheContext.Provider>
  );
}

export function useActiveNiche(): NicheContextValue {
  const ctx = useContext(NicheContext);
  if (!ctx) {
    return {
      active: DEFAULT_NICHE,
      setActive: () => {},
      niches: NICHES,
    };
  }
  return ctx;
}
