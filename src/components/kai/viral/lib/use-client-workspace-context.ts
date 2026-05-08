/**
 * Hook que carrega o contexto completo de um cliente Kaleidos para uso pelos
 * viral apps (Sequência Viral / Reels / Radar) — voz/tom/persona/refs/library.
 *
 * NOTA: o nome `useClientContext` já está ocupado em `@/hooks/useClientContext`
 * (legacy: usado pelo AIContextTab via apiInvoke `generate-client-context`).
 * Aqui usamos `useClientWorkspaceContext` pra evitar colisão até o BACKEND
 * agent decidir consolidar. Se o BACKEND criar `@/hooks/useClientContext`
 * com a mesma shape, basta trocar o import nos consumers.
 *
 * Lê em paralelo:
 *  - clients (id, name, industry, tags, description)
 *  - client_preferences (key/value: tone, content_pillar, persona_*, brand_*)
 *  - client_websites
 *  - client_documents (top 20)
 *  - client_visual_references (top 20)
 *  - client_content_library (top 50, ordenado por created_at desc)
 *  - client_viral_competitors
 *  - client_viral_keywords
 *
 * Decodifica preferences key/value pra um objeto com tone (string) +
 * pillars (string[]) + persona ({age, pain, goal}) + brand ({do[], dont[]}).
 *
 * Cache TanStack Query 5min (staleTime). Disabled quando clientId é null
 * (Radar opera por nicho, não cliente — passa null lá).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientContextPersona {
  age: string | null;
  pain: string | null;
  goal: string | null;
}

export interface ClientContextBrand {
  do: string[];
  dont: string[];
}

export interface ClientContextClient {
  id: string;
  name: string;
  /** Coluna não tipada nos types gerados (live no DB via tags/runtime). */
  industry: string | null;
  tags: Record<string, unknown> | null;
  description: string | null;
}

export interface ClientWebsiteRow {
  id: string;
  url: string;
}

export interface ClientDocumentRow {
  id: string;
  /** Schema canônico: `name` + `file_type` (renderizado como filename). */
  name: string;
  file_type: string | null;
}

export interface ClientVisualReferenceRow {
  id: string;
  title: string | null;
  image_url: string;
  reference_type: string | null;
}

export interface ClientContentLibraryRow {
  id: string;
  title: string | null;
  content: string | null;
  content_type: string | null;
  metadata: Record<string, unknown> | null;
  metrics?: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ClientViralCompetitor {
  id: string;
  client_id: string;
  handle: string | null;
  platform: string | null;
  notes: string | null;
}

export interface ClientViralKeyword {
  id: string;
  client_id: string;
  keyword: string | null;
}

export interface ClientWorkspaceContext {
  client: ClientContextClient | null;
  tone: string | null;
  pillars: string[];
  persona: ClientContextPersona;
  brand: ClientContextBrand;
  websites: ClientWebsiteRow[];
  documents: ClientDocumentRow[];
  visualReferences: ClientVisualReferenceRow[];
  contentLibrary: ClientContentLibraryRow[];
  competitors: ClientViralCompetitor[];
  keywords: ClientViralKeyword[];
}

const EMPTY_CONTEXT: ClientWorkspaceContext = {
  client: null,
  tone: null,
  pillars: [],
  persona: { age: null, pain: null, goal: null },
  brand: { do: [], dont: [] },
  websites: [],
  documents: [],
  visualReferences: [],
  contentLibrary: [],
  competitors: [],
  keywords: [],
};

export function useClientWorkspaceContext(clientId: string | null | undefined) {
  return useQuery<ClientWorkspaceContext>({
    queryKey: ["client-workspace-context", clientId],
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!clientId) return EMPTY_CONTEXT;

      const [
        clientResult,
        prefsResult,
        websitesResult,
        documentsResult,
        visualRefsResult,
        contentLibraryResult,
        competitorsResult,
        keywordsResult,
      ] = await Promise.all([
        // `industry` ainda não consta nos types gerados — `select("*")` traz
        // tudo o que o DB tem. Cast pra ClientContextClient na hidratação.
        supabase
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .maybeSingle(),
        supabase
          .from("client_preferences")
          .select("preference_type, preference_value, confidence")
          .eq("client_id", clientId),
        supabase
          .from("client_websites")
          .select("id, url")
          .eq("client_id", clientId)
          .limit(10),
        supabase
          .from("client_documents")
          .select("id, name, file_type")
          .eq("client_id", clientId)
          .limit(20),
        supabase
          .from("client_visual_references")
          .select("id, title, image_url, reference_type")
          .eq("client_id", clientId)
          .limit(20),
        supabase
          .from("client_content_library")
          .select("id, title, content, content_type, metadata, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(50),
        // viral_competitors / viral_keywords: tabelas existem mas
        // podem estar vazias e não estão sempre nos types gerados —
        // usar `from(...).select()` com cast `as any` quando necessário.
        // Aqui fazemos best-effort: se a tabela ainda não existir, o
        // erro é silenciado e retornamos array vazio.
        safeSelect("client_viral_competitors", clientId),
        safeSelect("client_viral_keywords", clientId),
      ]);

      const prefs = prefsResult.data || [];
      const tone =
        prefs.find((p) => p.preference_type === "tone")?.preference_value ??
        null;
      const pillars = prefs
        .filter((p) => p.preference_type === "content_pillar")
        .map((p) => p.preference_value)
        .filter(Boolean);
      const persona: ClientContextPersona = {
        age:
          prefs.find((p) => p.preference_type === "persona_age")
            ?.preference_value ?? null,
        pain:
          prefs.find((p) => p.preference_type === "persona_pain")
            ?.preference_value ?? null,
        goal:
          prefs.find((p) => p.preference_type === "persona_goal")
            ?.preference_value ?? null,
      };
      const brand: ClientContextBrand = {
        do: prefs
          .filter((p) => p.preference_type === "brand_do")
          .map((p) => p.preference_value)
          .filter(Boolean),
        dont: prefs
          .filter((p) => p.preference_type === "brand_dont")
          .map((p) => p.preference_value)
          .filter(Boolean),
      };

      // Casts via `unknown` — types gerados não têm `industry` em clients,
      // colunas `name`/`file_type` em client_documents, etc. Schema runtime
      // é a fonte da verdade — DB tem tudo isso, regen tipos Supabase
      // resolveria mas não vamos depender disso pra desbloquear o build.
      return {
        client:
          (clientResult.data
            ? (clientResult.data as unknown as ClientContextClient)
            : null) ?? null,
        tone,
        pillars,
        persona,
        brand,
        websites:
          (websitesResult.data as unknown as ClientWebsiteRow[] | null) ?? [],
        documents:
          (documentsResult.data as unknown as ClientDocumentRow[] | null) ?? [],
        visualReferences:
          (visualRefsResult.data as unknown as
            | ClientVisualReferenceRow[]
            | null) ?? [],
        contentLibrary:
          (contentLibraryResult.data as unknown as
            | ClientContentLibraryRow[]
            | null) ?? [],
        competitors: (competitorsResult as ClientViralCompetitor[]) ?? [],
        keywords: (keywordsResult as ClientViralKeyword[]) ?? [],
      };
    },
  });
}

/**
 * Retorna [] se a tabela ainda não existe ou está vazia. Evita que o hook
 * inteiro falhe quando `client_viral_competitors` / `client_viral_keywords`
 * não são parte dos types gerados ainda.
 */
async function safeSelect(table: string, clientId: string): Promise<unknown[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .eq("client_id", clientId);
    if (error) return [];
    return (data as unknown[]) ?? [];
  } catch {
    return [];
  }
}
