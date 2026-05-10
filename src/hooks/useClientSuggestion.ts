/**
 * useClientSuggestion — sugere o cliente mais provável pra um título de
 * planning_item ainda sem cliente atribuído.
 *
 * Heurística (intencionalmente simples — não vale gastar tokens IA pra isso):
 *
 *   1. Tokeniza o título (lowercase, remove stop words PT-BR).
 *   2. Pra cada cliente do workspace:
 *        - Junta nome + description + context_notes + social_handles
 *          + títulos das últimas 30 referências em `client_reference_library`.
 *        - Tokeniza igual.
 *        - Score = jaccard(títuloTokens, clienteTokens) * 100
 *                  + bonus(2x) se nome do cliente aparece literal no título.
 *   3. Retorna o cliente com maior score, desde que score >= 25.
 *
 * Por que client-side: já temos `useClients` + `client_reference_library`
 * em cache via TanStack — não precisa nem de extra fetch. Hook só roda
 * quando user efetivamente digita um título sem ter cliente selecionado.
 */
import { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClients } from '@/hooks/useClients';

const PT_STOP_WORDS = new Set([
  'a', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das',
  'e', 'ou', 'mas', 'que', 'quando', 'onde', 'porque', 'se',
  'em', 'no', 'na', 'nos', 'nas', 'com', 'sem', 'por', 'para', 'pra',
  'meu', 'minha', 'seu', 'sua', 'nosso', 'nossa',
  'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas',
  'é', 'são', 'foi', 'era', 'ser', 'estar', 'ter', 'haver',
  'mais', 'menos', 'muito', 'pouco', 'já', 'ainda', 'sempre',
  'isso', 'isto', 'aquilo', 'esse', 'essa', 'esses', 'essas',
  'post', 'posts', 'conteúdo', 'conteudo', 'sobre', 'tudo',
]);

function tokenize(text: string): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip accents
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !PT_STOP_WORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export interface ClientSuggestion {
  clientId: string;
  clientName: string;
  score: number; // 0-100
  matchedTokens: string[];
}

/**
 * Retorna sugestão do cliente mais provável (ou null) pra um título.
 * - Debounced: 400ms desde última mudança no título.
 * - Min score 25 pra evitar falso-positivo.
 * - Retorna `null` quando título tem <10 chars ou já há cliente selecionado.
 */
export function useClientSuggestion(
  title: string,
  alreadySelectedClientId: string | null | undefined
): ClientSuggestion | null {
  const { clients } = useClients();
  const [debouncedTitle, setDebouncedTitle] = useState(title);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(title), 400);
    return () => clearTimeout(t);
  }, [title]);

  // Fetch refs por cliente (snapshot leve — só title + reference_type).
  // Cacheado 5min — refs não mudam tão rápido.
  const { data: refsByClient = {} } = useQuery({
    queryKey: ['client-suggestion-refs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_reference_library')
        .select('client_id, title, reference_type')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) {
        console.warn('[useClientSuggestion] refs fetch failed:', error);
        return {} as Record<string, string[]>;
      }
      const map: Record<string, string[]> = {};
      for (const r of data || []) {
        if (!r.client_id) continue;
        (map[r.client_id] ||= []).push(r.title);
      }
      return map;
    },
    enabled: !alreadySelectedClientId && debouncedTitle.length >= 10,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    if (alreadySelectedClientId) return null;
    if (!debouncedTitle || debouncedTitle.trim().length < 10) return null;
    if (!clients || clients.length === 0) return null;

    const titleTokens = tokenize(debouncedTitle);
    if (titleTokens.size === 0) return null;

    let bestScore = 0;
    let best: ClientSuggestion | null = null;

    for (const c of clients) {
      const haystackParts: string[] = [c.name, c.description ?? '', c.context_notes ?? ''];
      const social = c.social_media as Record<string, string> | null | undefined;
      if (social && typeof social === 'object') {
        for (const v of Object.values(social)) {
          if (typeof v === 'string') haystackParts.push(v);
        }
      }
      const tags = c.tags as Record<string, string> | null | undefined;
      if (tags && typeof tags === 'object') {
        for (const v of Object.values(tags)) {
          if (typeof v === 'string') haystackParts.push(v);
        }
      }
      // Adiciona títulos das refs deste cliente (sinaliza temas recorrentes)
      const refTitles = refsByClient[c.id] || [];
      haystackParts.push(...refTitles.slice(0, 30));

      const clientTokens = tokenize(haystackParts.join(' '));
      const sim = jaccard(titleTokens, clientTokens);

      // Bonus: nome do cliente literal (ou parte) aparece no título
      const nameMatch = c.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
      const titleNorm = debouncedTitle
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
      const literalBonus = titleNorm.includes(nameMatch) ? 0.4 : 0;

      const score = Math.min(100, Math.round((sim + literalBonus) * 100));

      if (score > bestScore && score >= 25) {
        bestScore = score;
        const matched: string[] = [];
        for (const t of titleTokens) if (clientTokens.has(t)) matched.push(t);
        best = {
          clientId: c.id,
          clientName: c.name,
          score,
          matchedTokens: matched.slice(0, 5),
        };
      }
    }

    return best;
  }, [debouncedTitle, clients, refsByClient, alreadySelectedClientId]);
}
