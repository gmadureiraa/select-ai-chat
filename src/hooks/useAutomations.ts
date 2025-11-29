import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Automation, AutomationWithClient } from "@/types/automation";

export const useAutomations = (clientId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: automations, isLoading } = useQuery({
    queryKey: clientId ? ["automations", clientId] : ["automations"],
    queryFn: async () => {
      let query = supabase
        .from("automations")
        .select("*, clients(id, name, description)")
        .order("created_at", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data.map(item => ({
        ...item,
        data_sources: (item.data_sources as any) || [],
        actions: (item.actions as any) || [],
        schedule_days: (item.schedule_days as any) || [],
        email_recipients: item.email_recipients || [],
      })) as AutomationWithClient[];
    },
  });

  const createAutomation = useMutation({
    mutationFn: async (automation: Partial<Automation>) => {
      const payload = {
        ...automation,
        data_sources: automation.data_sources || [],
        actions: automation.actions || [],
        schedule_days: automation.schedule_days || [],
        email_recipients: automation.email_recipients || [],
      };
      
      const { data, error } = await supabase
        .from("automations")
        .insert([payload as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "Automação criada",
        description: "A automação foi criada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a automação.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const updateAutomation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Automation> & { id: string }) => {
      const payload = {
        ...updates,
        data_sources: updates.data_sources || [],
        actions: updates.actions || [],
        schedule_days: updates.schedule_days || [],
        email_recipients: updates.email_recipients || [],
      };
      
      const { data, error } = await supabase
        .from("automations")
        .update(payload as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "Automação atualizada",
        description: "As alterações foram salvas!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a automação.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "Automação excluída",
        description: "A automação foi removida.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a automação.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const toggleAutomation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from("automations")
        .update({ is_active: isActive })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status da automação.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const runAutomation = useMutation({
    mutationFn: async (automationId: string) => {
      const { data, error } = await supabase.functions.invoke("run-automation", {
        body: { automationId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Automação executada",
        description: "A automação foi executada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["automation-runs"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao executar",
        description: "Não foi possível executar a automação.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  return {
    automations,
    isLoading,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    runAutomation,
  };
};
