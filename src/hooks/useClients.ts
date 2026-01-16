import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

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

  const { data: clients = [], isLoading } = useQuery({
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

  const createClient = useMutation({
    mutationFn: async (clientData: CreateClientData) => {
      // === DIAGNÓSTICO 1: Verificar workspace ===
      console.log("[createClient] workspace context:", { 
        workspaceId: workspace?.id,
        workspaceName: workspace?.name 
      });
      
      if (!workspace?.id) {
        const err = new Error("Você não está em nenhum workspace");
        console.error("[createClient] ERRO: Sem workspace", err);
        throw err;
      }

      // === DIAGNÓSTICO 2: Verificar sessão/autenticação ===
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
      
      // === DIAGNÓSTICO 3: Log do payload completo ===
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

      // === DIAGNÓSTICO 4: Log detalhado do erro ===
      if (error) {
        console.error("[createClient] SUPABASE ERROR:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        // Enriquecer o erro com detalhes
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
