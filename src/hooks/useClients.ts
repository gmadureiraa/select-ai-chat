import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface Client {
  id: string;
  name: string;
  description: string | null;
  context_notes: string | null;
  identity_guide: string | null;
  avatar_url: string | null;
  social_media: Record<string, string>;
  tags: Record<string, string>;
  function_templates: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateClientData {
  name: string;
  description: string | null;
  context_notes: string | null;
  social_media?: Record<string, string>;
  tags?: Record<string, string>;
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
      console.log("[createClient] workspace context:", { 
        workspaceId: workspace?.id,
        workspaceName: workspace?.name 
      });
      
      if (!workspace?.id) {
        const err = new Error("Você não está em nenhum workspace");
        console.error("[createClient] ERRO: Sem workspace", err);
        throw err;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log("[createClient] session check:", { 
        hasSession: !!sessionData?.session,
        userId: sessionData?.session?.user?.id,
        sessionError 
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log("[createClient] user check:", { 
        userId: user?.id,
        userEmail: user?.email,
        userError 
      });

      if (!user?.id) {
        const err = new Error("Você precisa estar logado para criar perfis");
        console.error("[createClient] ERRO: Sem usuário autenticado", err);
        throw err;
      }

      const { websites, ...client } = clientData;
      
      const insertPayload = {
        name: client.name,
        description: client.description,
        context_notes: client.context_notes,
        user_id: user.id,
        social_media: client.social_media || {},
        tags: client.tags || {},
        function_templates: client.function_templates || [],
        workspace_id: workspace.id,
      };
      console.log("[createClient] INSERT payload:", insertPayload);

      const { data, error } = await supabase
        .from("clients")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error("[createClient] SUPABASE ERROR:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        const enrichedError = new Error(
          `${error.message} (code: ${error.code})${error.hint ? ` - Hint: ${error.hint}` : ""}`
        );
        (enrichedError as any).code = error.code;
        (enrichedError as any).details = error.details;
        (enrichedError as any).hint = error.hint;
        throw enrichedError;
      }
      
      console.log("[createClient] SUCCESS:", data);
      
      // Add websites with scraping if provided
      if (websites && websites.length > 0) {
        for (const url of websites) {
          try {
            await supabase.functions.invoke("scrape-website", {
              body: { url, clientId: data.id },
            });
          } catch (err) {
            console.error("Error scraping website:", url, err);
          }
        }
      }
      
      return data;
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
      const { data, error } = await supabase
        .from("clients")
        .update(client)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", workspace?.id] });
      toast({
        title: "Perfil atualizado",
        description: "O perfil foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
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
