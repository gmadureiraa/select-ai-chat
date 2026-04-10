import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClickUpSpace {
  id: string;
  name: string;
  lists: { id: string; name: string; folder: string | null }[];
}

export interface ClickUpTeam {
  team_id: string;
  team_name: string;
  spaces: ClickUpSpace[];
}

export interface ListMapping {
  list_id: string;
  list_name: string;
  folder_name: string;
  space_name: string;
  client_id: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function useClickUpImport() {
  const [teams, setTeams] = useState<ClickUpTeam[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const discover = useCallback(async () => {
    setIsDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-clickup', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: undefined,
      });

      // The edge function uses query params, so we need to call differently
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/import-clickup?action=discover`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to discover ClickUp structure');
      }

      const result = await res.json();
      setTeams(result.teams || []);
      return result.teams || [];
    } catch (e: any) {
      toast.error('Erro ao conectar ao ClickUp: ' + e.message);
      throw e;
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  const importTasks = useCallback(async (workspaceId: string, mappings: ListMapping[]) => {
    setIsImporting(true);
    setResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/import-clickup?action=import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            mappings: mappings.map(m => ({
              list_id: m.list_id,
              client_id: m.client_id,
              space_name: m.space_name,
              folder_name: m.folder_name || '',
            })),
            since_date: '2026-04-01',
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const importResult: ImportResult = await res.json();
      setResult(importResult);
      
      if (importResult.imported > 0) {
        toast.success(`${importResult.imported} itens importados com sucesso!`);
      }
      if (importResult.skipped > 0) {
        toast.info(`${importResult.skipped} itens já existiam (ignorados)`);
      }
      if (importResult.errors.length > 0) {
        toast.warning(`${importResult.errors.length} erros durante importação`);
      }

      return importResult;
    } catch (e: any) {
      toast.error('Erro na importação: ' + e.message);
      throw e;
    } finally {
      setIsImporting(false);
    }
  }, []);

  return { teams, isDiscovering, isImporting, result, discover, importTasks };
}
