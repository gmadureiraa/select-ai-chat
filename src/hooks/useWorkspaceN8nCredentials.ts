import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

// Helper to extract base URL (removes paths like /home/workflows)
function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return url;
  }
}

interface N8nCredentials {
  id: string;
  workspace_id: string;
  n8n_api_url: string;
  n8n_api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useWorkspaceN8nCredentials() {
  const { workspace } = useWorkspaceContext();
  const queryClient = useQueryClient();

  const { data: credentials, isLoading, error } = useQuery({
    queryKey: ['workspace-n8n-credentials', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;

      const { data, error } = await supabase
        .from('workspace_n8n_credentials')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching n8n credentials:', error);
        throw error;
      }

      return data as N8nCredentials | null;
    },
    enabled: !!workspace?.id,
  });

  const saveCredentials = useMutation({
    mutationFn: async ({ apiUrl, apiKey }: { apiUrl: string; apiKey: string }) => {
      if (!workspace?.id) throw new Error('No workspace selected');

      // Clean URL to base URL only (remove paths like /home/workflows)
      const cleanUrl = getBaseUrl(apiUrl);

      const { data: existing } = await supabase
        .from('workspace_n8n_credentials')
        .select('id')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('workspace_n8n_credentials')
          .update({
            n8n_api_url: cleanUrl,
            n8n_api_key: apiKey,
            is_active: true,
          })
          .eq('workspace_id', workspace.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('workspace_n8n_credentials')
          .insert({
            workspace_id: workspace.id,
            n8n_api_url: cleanUrl,
            n8n_api_key: apiKey,
            is_active: true,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-n8n-credentials', workspace?.id] });
      toast.success('Credenciais n8n salvas com sucesso');
    },
    onError: (error) => {
      console.error('Error saving n8n credentials:', error);
      toast.error('Erro ao salvar credenciais n8n');
    },
  });

  const deleteCredentials = useMutation({
    mutationFn: async () => {
      if (!workspace?.id) throw new Error('No workspace selected');

      const { error } = await supabase
        .from('workspace_n8n_credentials')
        .delete()
        .eq('workspace_id', workspace.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-n8n-credentials', workspace?.id] });
      toast.success('Credenciais n8n removidas');
    },
    onError: (error) => {
      console.error('Error deleting n8n credentials:', error);
      toast.error('Erro ao remover credenciais n8n');
    },
  });

  return {
    credentials,
    isLoading,
    error,
    isConfigured: !!credentials?.is_active,
    saveCredentials,
    deleteCredentials,
    workspaceId: workspace?.id,
  };
}