import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ClientTemplate, CreateTemplateData, TemplateRule, AutomationConfig, DEFAULT_CHAT_RULES, DEFAULT_IMAGE_RULES } from "@/types/template";

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
      
      // Parse rules from JSON - preserve ALL fields
      return (data || []).map(template => ({
        id: template.id,
        client_id: template.client_id,
        name: template.name,
        type: (template.type as 'chat' | 'image' | 'automation') || 'chat',
        created_at: template.created_at,
        updated_at: template.updated_at,
        rules: Array.isArray(template.rules) 
          ? (template.rules as any[]).map((rule: any) => ({
              id: rule.id || crypto.randomUUID(),
              content: rule.content || String(rule),
              type: rule.type || 'text',
              file_url: rule.file_url || undefined
            }))
          : [],
        automation_config: template.type === 'automation' 
          ? (typeof template.rules === 'object' && !Array.isArray(template.rules) 
              ? template.rules as any
              : undefined)
          : undefined
      })) as ClientTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      let rulesData: any;
      
      if (data.type === 'automation') {
        // For automation, store config in rules field
        rulesData = data.automation_config || {
          schedule_type: 'manual',
          model: 'gpt-5-mini-2025-08-07',
          prompt: '',
        };
      } else {
        // For chat/image, store rules array
        const defaultRules = data.type === 'image' ? DEFAULT_IMAGE_RULES : DEFAULT_CHAT_RULES;
        rulesData = data.rules || defaultRules.map((content) => ({
          id: crypto.randomUUID(),
          content,
        }));
      }

      const { data: result, error } = await supabase
        .from("client_templates")
        .insert([{
          client_id: data.client_id,
          name: data.name,
          type: data.type,
          rules: rulesData,
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-templates", clientId] });
      toast({
        title: "Template criado",
        description: "Template adicionado com sucesso.",
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

      const { data, error } = await supabase
        .from("client_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
