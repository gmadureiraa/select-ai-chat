import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Hook para debouncing de valores
 * Útil para evitar chamadas excessivas durante digitação
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Hook for extraction URL cache
 */
const CACHE_KEY = 'canvas_url_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: any;
  timestamp: number;
}

export function useExtractionCache() {
  const getCache = useCallback((url: string): any | null => {
    try {
      const cache = localStorage.getItem(CACHE_KEY);
      if (!cache) return null;
      
      const entries: Record<string, CacheEntry> = JSON.parse(cache);
      const entry = entries[url];
      
      if (!entry) return null;
      
      // Check if cache is still valid
      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        // Remove expired entry
        delete entries[url];
        localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
        return null;
      }
      
      return entry.data;
    } catch {
      return null;
    }
  }, []);

  const setCache = useCallback((url: string, data: any) => {
    try {
      const cache = localStorage.getItem(CACHE_KEY);
      const entries: Record<string, CacheEntry> = cache ? JSON.parse(cache) : {};
      
      entries[url] = {
        data,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore cache errors
    }
  }, []);

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return { getCache, setCache, clearCache };
}
