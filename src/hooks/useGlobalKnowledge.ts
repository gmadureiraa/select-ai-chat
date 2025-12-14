import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "./useWorkspace";

export type KnowledgeCategory = 
  | 'copywriting'
  | 'storytelling'
  | 'hooks'
  | 'psychology'
  | 'structure'
  | 'engagement'
  | 'marketing_strategy'
  | 'growth_hacking'
  | 'social_media'
  | 'seo'
  | 'branding'
  | 'analytics'
  | 'audience'
  | 'other';

export interface GlobalKnowledge {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  source_file: string | null;
  page_count: number | null;
  metadata: Record<string, any>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeData {
  title: string;
  content: string;
  category: KnowledgeCategory;
  source_file?: string;
  page_count?: number;
  metadata?: Record<string, any>;
  tags?: string[];
}

export const KNOWLEDGE_CATEGORIES: { value: KnowledgeCategory; label: string }[] = [
  { value: 'copywriting', label: 'Copywriting' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'hooks', label: 'Hooks & Aberturas' },
  { value: 'psychology', label: 'Psicologia da Persuasão' },
  { value: 'structure', label: 'Estruturas de Conteúdo' },
  { value: 'engagement', label: 'Engajamento' },
  { value: 'marketing_strategy', label: 'Estratégia de Marketing' },
  { value: 'growth_hacking', label: 'Growth Hacking' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'seo', label: 'SEO & Tráfego' },
  { value: 'branding', label: 'Branding & Posicionamento' },
  { value: 'analytics', label: 'Analytics & Métricas' },
  { value: 'audience', label: 'Audiência & Persona' },
  { value: 'other', label: 'Outros' },
];

export function useGlobalKnowledge() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  const { data: knowledge, isLoading } = useQuery({
    queryKey: ['global-knowledge', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const { data, error } = await supabase
        .from('global_knowledge')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GlobalKnowledge[];
    },
    enabled: !!workspace?.id,
  });

  const createKnowledge = useMutation({
    mutationFn: async (data: CreateKnowledgeData) => {
      if (!workspace?.id) throw new Error('No workspace');

      const { error } = await supabase
        .from('global_knowledge')
        .insert({
          workspace_id: workspace.id,
          title: data.title,
          content: data.content,
          category: data.category,
          source_file: data.source_file || null,
          page_count: data.page_count || null,
          metadata: data.metadata || {},
          tags: data.tags || [],
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-knowledge'] });
      toast.success('Conhecimento adicionado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao adicionar conhecimento: ' + error.message);
    },
  });

  const updateKnowledge = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateKnowledgeData> & { id: string }) => {
      const { error } = await supabase
        .from('global_knowledge')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-knowledge'] });
      toast.success('Conhecimento atualizado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const deleteKnowledge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('global_knowledge')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-knowledge'] });
      toast.success('Conhecimento removido!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  return {
    knowledge: knowledge || [],
    isLoading,
    createKnowledge,
    updateKnowledge,
    deleteKnowledge,
  };
}
