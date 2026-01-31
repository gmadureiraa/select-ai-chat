import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type TriggerType = 'schedule' | 'rss' | 'webhook';

export interface ScheduleConfig {
  type: 'daily' | 'weekly' | 'monthly';
  days?: number[];
  time?: string;
}

export interface RSSConfig {
  url: string;
  last_guid?: string;
  last_checked?: string;
}

export interface WebhookConfig {
  secret: string;
}

export type TriggerConfig = ScheduleConfig | RSSConfig | WebhookConfig;

export type ImageStyle = 'photographic' | 'illustration' | 'minimalist' | 'vibrant';

export interface PlanningAutomation {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  target_column_id: string | null;
  platform: string | null;
  content_type: string;
  auto_generate_content: boolean;
  prompt_template: string | null;
  auto_publish: boolean;
  // Image generation fields
  auto_generate_image: boolean;
  image_prompt_template: string | null;
  image_style: ImageStyle | null;
  // Tracking fields
  last_triggered_at: string | null;
  items_created: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationInput {
  name: string;
  client_id?: string | null;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  target_column_id?: string | null;
  platform?: string | null;
  content_type?: string;
  auto_generate_content?: boolean;
  prompt_template?: string | null;
  auto_publish?: boolean;
  // Image generation
  auto_generate_image?: boolean;
  image_prompt_template?: string | null;
  image_style?: ImageStyle | null;
}

export interface UpdateAutomationInput extends Partial<CreateAutomationInput> {
  id: string;
  is_active?: boolean;
}

// Helper to convert TriggerConfig to Json-compatible format
function configToJson(config: TriggerConfig): Json {
  return config as unknown as Json;
}

// Helper to parse Json to TriggerConfig
function jsonToConfig(json: Json): TriggerConfig {
  return json as unknown as TriggerConfig;
}

export function usePlanningAutomations() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();

  // Fetch all automations for workspace
  const { data: automations, isLoading, refetch } = useQuery({
    queryKey: ['planning-automations', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase
        .from('planning_automations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform the data to match our interface
      return (data || []).map(item => ({
        ...item,
        trigger_config: jsonToConfig(item.trigger_config),
      })) as PlanningAutomation[];
    },
    enabled: !!workspaceId,
  });

  // Create automation
  const createAutomation = useMutation({
    mutationFn: async (input: CreateAutomationInput) => {
      if (!workspaceId) throw new Error('Workspace not found');

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('planning_automations')
        .insert({
          name: input.name,
          workspace_id: workspaceId,
          client_id: input.client_id,
          trigger_type: input.trigger_type,
          trigger_config: configToJson(input.trigger_config),
          target_column_id: input.target_column_id,
          platform: input.platform,
          content_type: input.content_type || 'social_post',
          auto_generate_content: input.auto_generate_content || false,
          prompt_template: input.prompt_template,
          auto_publish: input.auto_publish || false,
          auto_generate_image: input.auto_generate_image || false,
          image_prompt_template: input.image_prompt_template,
          image_style: input.image_style || 'photographic',
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-automations', workspaceId] });
      toast.success('Automação criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating automation:', error);
      toast.error('Erro ao criar automação');
    },
  });

  // Update automation
  const updateAutomation = useMutation({
    mutationFn: async ({ id, ...input }: UpdateAutomationInput) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.client_id !== undefined) updateData.client_id = input.client_id;
      if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type;
      if (input.trigger_config !== undefined) updateData.trigger_config = configToJson(input.trigger_config);
      if (input.target_column_id !== undefined) updateData.target_column_id = input.target_column_id;
      if (input.platform !== undefined) updateData.platform = input.platform;
      if (input.content_type !== undefined) updateData.content_type = input.content_type;
      if (input.auto_generate_content !== undefined) updateData.auto_generate_content = input.auto_generate_content;
      if (input.prompt_template !== undefined) updateData.prompt_template = input.prompt_template;
      if ((input as any).auto_publish !== undefined) updateData.auto_publish = (input as any).auto_publish;
      if ((input as any).auto_generate_image !== undefined) updateData.auto_generate_image = (input as any).auto_generate_image;
      if ((input as any).image_prompt_template !== undefined) updateData.image_prompt_template = (input as any).image_prompt_template;
      if ((input as any).image_style !== undefined) updateData.image_style = (input as any).image_style;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;
      
      const { data, error } = await supabase
        .from('planning_automations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-automations', workspaceId] });
      toast.success('Automação atualizada');
    },
    onError: (error) => {
      console.error('Error updating automation:', error);
      toast.error('Erro ao atualizar automação');
    },
  });

  // Toggle automation active state
  const toggleAutomation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('planning_automations')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['planning-automations', workspaceId] });
      toast.success(data.is_active ? 'Automação ativada' : 'Automação pausada');
    },
    onError: (error) => {
      console.error('Error toggling automation:', error);
      toast.error('Erro ao alterar status');
    },
  });

  // Delete automation
  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('planning_automations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-automations', workspaceId] });
      toast.success('Automação excluída');
    },
    onError: (error) => {
      console.error('Error deleting automation:', error);
      toast.error('Erro ao excluir automação');
    },
  });

  // Manually trigger an automation (for testing)
  const triggerAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('process-automations', {
        body: { automationId: id },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planning-automations', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['planning-items'] });
      toast.success('Automação executada');
    },
    onError: (error) => {
      console.error('Error triggering automation:', error);
      toast.error('Erro ao executar automação');
    },
  });

  return {
    automations: automations || [],
    isLoading,
    refetch,
    createAutomation,
    updateAutomation,
    toggleAutomation,
    deleteAutomation,
    triggerAutomation,
  };
}
