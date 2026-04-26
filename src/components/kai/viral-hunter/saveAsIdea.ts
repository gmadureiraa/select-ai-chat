/**
 * Salva uma descoberta do Viral Hunter (notícia/vídeo) como uma ideia
 * no Planejamento (planning_items com status='idea').
 *
 * Estratégia:
 *  - Pega a coluna kanban mais à esquerda do workspace (geralmente "Ideias").
 *  - Cria com title + content rico contendo título da fonte, snippet, link.
 *  - Marca platform=instagram por default (usuário pode trocar depois).
 *  - Guarda metadata.source = { kind, url, thumbnail, ... } pra rastreabilidade.
 */

import { supabase } from "@/integrations/supabase/client";

export type IdeaSourceKind = "news" | "youtube" | "competitor";

export interface SaveAsIdeaInput {
  clientId: string;
  workspaceId: string;
  title: string;
  /** Texto pra ir no campo `content` (vai virar o briefing inicial). */
  briefing: string;
  source: {
    kind: IdeaSourceKind;
    url: string;
    sourceName?: string;
    thumbnail?: string;
    publishedAt?: string;
  };
  platform?: string;
}

async function getIdeasColumnId(workspaceId: string): Promise<string | null> {
  // Procura coluna do tipo 'idea' (default), senão a primeira por position
  const { data } = await supabase
    .from("kanban_columns")
    .select("id, column_type, position")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (!data?.length) return null;
  const ideaCol = data.find((c) => c.column_type === "idea");
  return (ideaCol ?? data[0]).id;
}

export async function saveAsIdea(input: SaveAsIdeaInput): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const columnId = await getIdeasColumnId(input.workspaceId);

  const briefing = [
    input.briefing.trim(),
    "",
    `Fonte: ${input.source.sourceName ?? input.source.url}`,
    input.source.url,
  ].join("\n").trim();

  const { data, error } = await supabase
    .from("planning_items")
    .insert({
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      column_id: columnId,
      title: input.title.slice(0, 200),
      content: briefing,
      platform: input.platform ?? "instagram",
      status: "idea",
      created_by: user.id,
      metadata: {
        source: input.source,
        origin: "viral_hunter",
      },
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}
