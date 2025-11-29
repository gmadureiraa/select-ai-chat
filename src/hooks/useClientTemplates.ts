import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ClientTemplate, CreateTemplateData, TemplateRule, DEFAULT_TEMPLATE_RULES } from "@/types/template";

export const useClientTemplates = (clientId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["client-templates", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_templates")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Parse rules from JSON
      return (data || []).map(template => ({
        id: template.id,
        client_id: template.client_id,
        name: template.name,
        created_at: template.created_at,
        updated_at: template.updated_at,
        rules: Array.isArray(template.rules) 
          ? (template.rules as any[]).map((rule: any) => ({
              id: rule.id || crypto.randomUUID(),
              content: rule.content || String(rule)
            }))
          : []
      })) as ClientTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      const rules = data.rules || DEFAULT_TEMPLATE_RULES.map((content) => ({
        id: crypto.randomUUID(),
        content,
      }));

      const { error } = await supabase
        .from("client_templates")
        .insert([{
          client_id: data.client_id,
          name: data.name,
          rules: rules as any,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-templates", clientId] });
      toast({
        title: "Template criado",
        description: "Template adicionado com regras padrões.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, name, rules }: { id: string; name?: string; rules?: TemplateRule[] }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (rules !== undefined) updates.rules = rules as any;

      const { error } = await supabase
        .from("client_templates")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-templates", clientId] });
      toast({
        title: "Template atualizado",
        description: "Alterações salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-templates", clientId] });
      toast({
        title: "Template excluído",
        description: "Template removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    templates: templates || [],
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};
