import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiInvoke } from '../lib/apiInvoke';

export interface Client {
  id: string;
  name: string;
  description: string | null;
  context_notes: string | null;
  identity_guide: string | null;
  avatar_url: string | null;
  social_media: Record<string, string>;
  tags: Record<string, string>;
  /** @deprecated migrado pra tabela client_templates (migration 20251129084845). */
  function_templates?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateClientData {
  name: string;
  description: string | null;
  context_notes: string | null;
  social_media?: Record<string, string>;
  tags?: Record<string, string>;
  /** @deprecated ignorado pelo handler /api/client-create. Use client_templates. */
  function_templates?: string[];
  websites?: string[];
}

export const useClients = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const { isAdminOrOwner } = useWorkspace();

  // Fetch current workspace member id
  const { data: currentMember } = useQuery({
    queryKey: ["current-workspace-member", workspace?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id || !workspace?.id) return null;
      
      const { data } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .maybeSingle();
      
      return data;
    },
    enabled: !!workspace?.id,
  });

  // Fetch member client access restrictions (only for non-admin/owner)
  const { data: memberClientAccess = [] } = useQuery({
    queryKey: ["member-client-access", currentMember?.id],
    queryFn: async () => {
      if (!currentMember?.id) return [];
      
      const { data } = await supabase
        .from("workspace_member_clients")
        .select("client_id")
        .eq("workspace_member_id", currentMember.id);
      
      return data || [];
    },
    enabled: !!currentMember?.id && !isAdminOrOwner,
  });

  // Fetch all clients from workspace
  const { data: allClients = [], isLoading } = useQuery({
    queryKey: ["clients", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!workspace?.id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Filter clients based on member access
  const clients = useMemo(() => {
    // Admins/Owners see all clients
    if (isAdminOrOwner) return allClients;
    
    // If no restrictions defined, member sees all clients (default behavior)
    if (memberClientAccess.length === 0) return allClients;
    
    // Filter to only show clients the member has access to
    const allowedIds = new Set(memberClientAccess.map(m => m.client_id));
    return allClients.filter(c => allowedIds.has(c.id));
  }, [allClients, memberClientAccess, isAdminOrOwner]);

  const createClient = useMutation({
    mutationFn: async (clientData: CreateClientData) => {
      if (!workspace?.id) {
        throw new Error("Você não está em nenhum workspace");
      }

      // P0 fix audit 2026-05-16: antes esse hook fazia
      //   supabase.from('clients').insert(insertPayload)
      // bypassando o handler /api/client-create (que tem Zod + auth +
      // verificacao de workspace_member). Agora delegamos ao handler.
      //
      // `function_templates` foi DEPRECATED — migration 20251129084845
      // moveu pra tabela client_templates. Aceitamos no input pra nao
      // quebrar callers legacy, mas ignoramos (handler nao escreve).
      const { websites, function_templates: _fnTpl, ...rest } = clientData;

      const { data, error } = await apiInvoke("client-create", {
        body: {
          name: rest.name,
          description: rest.description ?? undefined,
          context_notes: rest.context_notes ?? undefined,
          social_media: rest.social_media || {},
          tags: rest.tags || {},
          workspace_id: workspace.id,
        },
      });

      if (error) {
        const message = error.message || "Erro ao criar perfil";
        const enrichedError = new Error(message);
        (enrichedError as any).code = (error as any)?.code;
        throw enrichedError;
      }

      const client = data?.client ?? data;
      if (!client?.id) {
        throw new Error("Cliente nao retornado pelo handler /api/client-create");
      }

      // Add websites with scraping if provided (delega pro handler scrape-website,
      // que ja faz auth + assertClientAccess internamente).
      if (websites && websites.length > 0) {
        for (const url of websites) {
          try {
            await apiInvoke("scrape-website", {
              body: { url, clientId: client.id },
            });
          } catch (err) {
            console.error("Error scraping website:", url, err);
          }
        }
      }

      return client as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", workspace?.id] });
      toast({
        title: "Perfil criado",
        description: "O perfil foi criado com sucesso.",
      });
    },
    onError: (error: any) => {
      console.error("[createClient] onError handler:", error);
      toast({
        title: "Erro ao criar perfil",
        description: `${error.message || "Não foi possível criar o perfil."}`,
        variant: "destructive",
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...client }: Partial<Client> & { id: string }) => {
      // P0 fix audit 2026-05-16: usar /api/client-update (com auth +
      // assertClientAccess + Zod) em vez de supabase.from('clients').update
      // direto. Handler tambem aceita brand_assets e ai_analysis (jsonb) a
      // partir do commit 4af29cb9.
      const payload: Record<string, unknown> = { client_id: id };
      for (const [k, v] of Object.entries(client)) {
        if (v !== undefined) payload[k] = v;
      }
      const { data, error } = await apiInvoke("client-update", { body: payload });
      if (error) throw new Error(error.message || "Erro ao atualizar perfil");
      return (data?.client ?? data) as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", workspace?.id] });
      toast({
        title: "Perfil atualizado",
        description: "O perfil foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      
      // Verify deletion actually happened (RLS may silently block)
      const { data: stillExists } = await supabase
        .from("clients")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      
      if (stillExists) {
        throw new Error("Não foi possível excluir o perfil. Verifique suas permissões.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", workspace?.id] });
      toast({
        title: "Perfil excluído",
        description: "O perfil foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o perfil.",
        variant: "destructive",
      });
    },
  });

  return {
    clients,
    isLoading,
    createClient,
    updateClient,
    deleteClient,
  };
};
