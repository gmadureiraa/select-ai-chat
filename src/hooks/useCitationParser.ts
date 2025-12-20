import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Citation } from "@/components/chat/CitationChip";

export interface ParsedCitation {
  id: string;
  type: "content_library" | "reference_library";
  title: string;
  category: string;
  content: string;
  source_url?: string;
}

export const useCitationParser = () => {
  /**
   * Busca o conteúdo completo de todas as citações
   */
  const fetchCitationContents = useCallback(async (citations: Citation[]): Promise<ParsedCitation[]> => {
    if (citations.length === 0) return [];

    const contentIds = citations
      .filter((c) => c.type === "content_library")
      .map((c) => c.id);
    
    const referenceIds = citations
      .filter((c) => c.type === "reference_library")
      .map((c) => c.id);

    const results: ParsedCitation[] = [];

    // Buscar conteúdos da biblioteca
    if (contentIds.length > 0) {
      const { data: contents } = await supabase
        .from("client_content_library")
        .select("id, title, content_type, content")
        .in("id", contentIds);

      if (contents) {
        results.push(
          ...contents.map((c) => ({
            id: c.id,
            type: "content_library" as const,
            title: c.title,
            category: c.content_type,
            content: c.content,
          }))
        );
      }
    }

    // Buscar referências
    if (referenceIds.length > 0) {
      const { data: references } = await supabase
        .from("client_reference_library")
        .select("id, title, reference_type, content, source_url")
        .in("id", referenceIds);

      if (references) {
        results.push(
          ...references.map((r) => ({
            id: r.id,
            type: "reference_library" as const,
            title: r.title,
            category: r.reference_type,
            content: r.content,
            source_url: r.source_url || undefined,
          }))
        );
      }
    }

    return results;
  }, []);

  /**
   * Formata as citações para incluir no contexto do prompt
   */
  const formatCitationsForContext = useCallback((citations: ParsedCitation[]): string => {
    if (citations.length === 0) return "";

    return `## 📌 REFERÊNCIAS SELECIONADAS PELO USUÁRIO (PRIORIDADE MÁXIMA)

O usuário citou especificamente estes conteúdos. Use-os como base principal:

${citations
  .map(
    (c, idx) => `
### [${idx + 1}] ${c.title} (${c.category})
${c.source_url ? `**Fonte:** ${c.source_url}\n` : ""}
${c.content}
---`
  )
  .join("\n")}

**INSTRUÇÃO:** Baseie sua resposta PRIMARIAMENTE nestes conteúdos citados.
`;
  }, []);

  return {
    fetchCitationContents,
    formatCitationsForContext,
  };
};
