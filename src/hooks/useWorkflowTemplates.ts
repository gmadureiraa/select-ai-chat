import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  thumbnail_url: string | null;
  workflow_config: Record<string, any>;
  nodes: any[];
  connections: any[];
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export const useWorkflowTemplates = () => {
  return useQuery({
    queryKey: ["workflow-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("name");

      if (error) throw error;

      return (data || []).map((t) => ({
        ...t,
        workflow_config: t.workflow_config as Record<string, any>,
        nodes: t.nodes as any[],
        connections: t.connections as any[],
      })) as WorkflowTemplate[];
    },
  });
};
