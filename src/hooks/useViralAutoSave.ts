/**
 * Hook genérico de auto-save pra rascunhos dos viral tabs (SV/Reels/Radar).
 *
 * Substitui os useEffects inline duplicados em cada MainApp/create-new que
 * persistem `kai-viral-<tab>-draft-<clientId>` em localStorage. Centraliza:
 *  - debounce (default 1s)
 *  - status transicional ('idle' | 'saving' | 'saved' | 'error')
 *  - lastSavedAt (Date | null)
 *  - restore() pra hidratar o form on mount
 *  - clear() pra limpar quando user finaliza (submit success)
 *
 * Convenção de chave (Fase G):
 *   `kai-viral-<tab>-draft-<clientId>`
 *   ex: `kai-viral-reels-draft-abc-123`, `kai-viral-sv-draft-abc-123`
 *
 * NOTA: o hook NÃO faz a hidratação automaticamente — quem chama deve invocar
 * `restore()` no mount + decidir como aplicar (geralmente: setState({ ...form,
 * ...restored })). Esse design evita que o hook faça assumptions sobre o
 * shape do form. Status só inclui 'saving' enquanto há diff pendente.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseViralAutoSaveOptions<T> {
  /** Chave única no storage. Inclua `clientId` pra namespacing por cliente. */
  key: string;
  /** Dado a persistir. Re-roda toda vez que mudar (deep-compare via JSON). */
  data: T;
  /** Debounce em ms antes de gravar. Default 1000ms. */
  delay?: number;
  /** `local` (persiste sessão) ou `session` (perde no fechar aba). */
  storage?: "local" | "session";
  /** Predicate: quando `false`, não persiste (ex: form vazio → não polui storage). */
  shouldPersist?: (data: T) => boolean;
  /** Liga/desliga o auto-save (ex: só persiste enquanto step === 'form'). */
  enabled?: boolean;
}

interface UseViralAutoSaveReturn<T> {
  /** Status atual do save. Use pra renderizar `<AutoSaveIndicator />`. */
  status: AutoSaveStatus;
  /** Timestamp do último save bem-sucedido. Útil pra mostrar "salvo às 14:32". */
  lastSavedAt: Date | null;
  /** Recupera o último draft persistido. Retorna `null` se não existir. */
  restore: () => T | null;
  /** Limpa o draft do storage e zera o status. Chamar após submit success. */
  clear: () => void;
}

interface PersistedPayload<T> {
  data: T;
  savedAt: string;
}

function getStore(storage: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  return storage === "session" ? window.sessionStorage : window.localStorage;
}

export function useViralAutoSave<T>({
  key,
  data,
  delay = 1000,
  storage = "local",
  shouldPersist,
  enabled = true,
}: UseViralAutoSaveOptions<T>): UseViralAutoSaveReturn<T> {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const lastSerializedRef = useRef<string>("");
  // `mounted` evita marcar 'saving' no primeiro render (sem mudança real).
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const store = getStore(storage);
    if (!store) return;

    const serialized = JSON.stringify(data);
    // Skip se nada mudou (re-render sem mudança no data) — evita flash do
    // indicator a cada keystroke desnecessário.
    if (serialized === lastSerializedRef.current && mountedRef.current) {
      return;
    }
    lastSerializedRef.current = serialized;
    mountedRef.current = true;

    if (shouldPersist && !shouldPersist(data)) {
      // Form vazio → limpa storage silenciosamente, sem indicador.
      try {
        store.removeItem(key);
      } catch {
        /* noop */
      }
      setStatus("idle");
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    setStatus("saving");
    timerRef.current = window.setTimeout(() => {
      try {
        const payload: PersistedPayload<T> = {
          data,
          savedAt: new Date().toISOString(),
        };
        store.setItem(key, JSON.stringify(payload));
        setStatus("saved");
        setLastSavedAt(new Date());
      } catch {
        // QuotaExceededError ou storage indisponível (Safari privado etc.)
        setStatus("error");
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
    // shouldPersist excluído de propósito — assumimos que é estável (memo
    // ou inline simples). Se mudar, o user deve memo-izar pra evitar loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, data, delay, storage, enabled]);

  const restore = useCallback((): T | null => {
    const store = getStore(storage);
    if (!store) return null;
    try {
      const raw = store.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedPayload<T> | T;
      // Tolerância retrocompat: drafts antigos eram salvos como `T` direto
      // (sem wrapper { data, savedAt }). Detecta wrapper pelo shape.
      if (
        parsed &&
        typeof parsed === "object" &&
        "data" in parsed &&
        "savedAt" in parsed
      ) {
        const payload = parsed as PersistedPayload<T>;
        try {
          setLastSavedAt(new Date(payload.savedAt));
        } catch {
          /* noop — savedAt corrompido */
        }
        return payload.data;
      }
      // Legacy: era salvo direto como T
      return parsed as T;
    } catch {
      return null;
    }
  }, [key, storage]);

  const clear = useCallback(() => {
    const store = getStore(storage);
    if (!store) return;
    try {
      store.removeItem(key);
    } catch {
      /* noop */
    }
    setStatus("idle");
    setLastSavedAt(null);
    lastSerializedRef.current = "";
  }, [key, storage]);

  return { status, lastSavedAt, restore, clear };
}
