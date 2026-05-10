// useKaiContext — bridge pro shell KAI dentro do SV port.
//
// O Sequência Viral standalone era single-tenant. KAI é multi-tenant — cada
// INSERT em viral_carousels precisa de workspace_id (NOT NULL) e idealmente
// client_id (opcional desde migrations 0032+0035).
//
// Esse hook lê:
//   - workspaceId — do WorkspaceContext do shell KAI
//   - clientId    — do query param ?client=<uuid> que o shell setta quando
//                   user seleciona cliente na sidebar
//
// Usado por todos os call-sites de upsertUserCarousel pra injetar contexto
// multi-tenant que o SV standalone não conhecia.
import { useSearchParams } from "react-router-dom";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

export interface KaiCarouselContext {
  workspaceId: string | null;
  clientId: string | null;
}

export function useKaiContext(): KaiCarouselContext {
  const { workspace } = useWorkspaceContext();
  const [searchParams] = useSearchParams();
  return {
    workspaceId: workspace?.id ?? null,
    clientId: searchParams.get("client"),
  };
}
