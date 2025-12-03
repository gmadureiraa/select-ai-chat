import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivities } from "@/hooks/useActivities";

export interface Client {
  id: string;
  name: string;
  description: string | null;
  context_notes: string | null;
  identity_guide: string | null;
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
  const { logActivity } = useActivities();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
  });

  const createClient = useMutation({
    mutationFn: async (clientData: CreateClientData) => {
      const { websites, ...client } = clientData;
      
      // Get user's workspace_id
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .single();
      
      if (!memberData?.workspace_id) {
        throw new Error("Você não pertence a nenhum workspace");
      }
      
      const { data, error } = await supabase
        .from("clients")
        .insert({
          ...client,
          social_media: client.social_media || {},
          tags: client.tags || {},
          function_templates: client.function_templates || [],
          workspace_id: memberData.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;
      
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      
      // Log activity
      logActivity.mutate({
        activityType: "client_created",
        entityType: "client",
        entityId: data.id,
        entityName: data.name,
        description: `Cliente "${data.name}" criado com sucesso`,
        metadata: { 
          hasSocialMedia: Object.keys(data.social_media || {}).length > 0 
        },
      });
      
      toast({
        title: "Cliente criado",
        description: "O cliente foi criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o cliente.",
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      
      // Log activity
      logActivity.mutate({
        activityType: "client_updated",
        entityType: "client",
        entityId: data.id,
        entityName: data.name,
        description: `Cliente "${data.name}" atualizado`,
      });
      
      toast({
        title: "Cliente atualizado",
        description: "O cliente foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o cliente.",
        variant: "destructive",
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      // Get client name before deleting
      const { data: clientData } = await supabase
        .from("clients")
        .select("name")
        .eq("id", id)
        .single();
      
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      
      return clientData?.name;
    },
    onSuccess: (clientName) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      
      // Log activity
      if (clientName) {
        logActivity.mutate({
          activityType: "client_deleted",
          entityType: "client",
          description: `Cliente "${clientName}" excluído`,
        });
      }
      
      toast({
        title: "Cliente excluído",
        description: "O cliente foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente.",
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
