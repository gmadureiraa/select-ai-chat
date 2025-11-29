import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ClientWebsite {
  id: string;
  client_id: string;
  url: string;
  scraped_content: string | null;
  scraped_markdown: string | null;
  last_scraped_at: string | null;
  created_at: string;
}

export const useClientWebsites = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: websites = [], isLoading } = useQuery({
    queryKey: ["client-websites", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_websites")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ClientWebsite[];
    },
    enabled: !!clientId,
  });

  const addWebsite = useMutation({
    mutationFn: async (url: string) => {
      // Call edge function to scrape website
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url, clientId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-websites", clientId] });
      toast({
        title: "Website adicionado",
        description: "O site foi extraído e adicionado ao contexto do cliente.",
      });
    },
    onError: (error) => {
      console.error("Error adding website:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o website.",
        variant: "destructive",
      });
    },
  });

  const deleteWebsite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_websites")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-websites", clientId] });
      toast({
        title: "Website removido",
        description: "O website foi removido do contexto.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o website.",
        variant: "destructive",
      });
    },
  });

  return {
    websites,
    isLoading,
    addWebsite,
    deleteWebsite,
  };
};
