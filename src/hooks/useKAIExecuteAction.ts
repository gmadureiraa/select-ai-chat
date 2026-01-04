import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  KAIActionType, 
  PendingAction, 
  CSVAnalysisResult 
} from "@/types/kaiActions";
import { toast } from "sonner";

interface ExecuteActionParams {
  action: PendingAction;
  clientId: string;
  workspaceId: string;
}

interface ExecuteActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

interface UseKAIExecuteActionReturn {
  executeAction: (params: ExecuteActionParams) => Promise<ExecuteActionResult>;
  isExecuting: boolean;
  progress: number;
}

/**
 * Hook for executing kAI actions (create content, import metrics, etc.)
 */
export function useKAIExecuteAction(): UseKAIExecuteActionReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);

  const executeAction = useCallback(
    async ({ action, clientId, workspaceId }: ExecuteActionParams): Promise<ExecuteActionResult> => {
      setIsExecuting(true);
      setProgress(0);

      try {
        switch (action.type) {
          case "upload_metrics":
            return await executeUploadMetrics(action, clientId, setProgress);

          case "create_planning_card":
            return await executeCreatePlanningCard(action, clientId, workspaceId);

          case "upload_to_library":
            return await executeUploadToLibrary(action, clientId);

          case "upload_to_references":
            return await executeUploadToReferences(action, clientId);

          case "create_content":
            return await executeCreateContent(action, clientId);

          default:
            return {
              success: false,
              message: `Ação "${action.type}" não suportada`,
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao executar ação";
        toast.error(message);
        return { success: false, message };
      } finally {
        setIsExecuting(false);
        setProgress(100);
      }
    },
    []
  );

  return {
    executeAction,
    isExecuting,
    progress,
  };
}

async function executeUploadMetrics(
  action: PendingAction,
  clientId: string,
  setProgress: (progress: number) => void
): Promise<ExecuteActionResult> {
  const csvData = action.preview?.data as unknown as CSVAnalysisResult | undefined;
  if (!csvData || !csvData.platform || !csvData.preview) {
    return { success: false, message: "Dados CSV não encontrados" };
  }

  const file = action.files?.[0];
  if (!file) {
    return { success: false, message: "Arquivo não encontrado" };
  }

  setProgress(20);

  // Read file content
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file.file);
  });

  setProgress(40);

  // Validate and import
  const { data, error } = await supabase.functions.invoke("validate-csv-import", {
    body: {
      clientId,
      platform: csvData.platform,
      csvContent: content,
    },
  });

  if (error) throw error;

  setProgress(80);

  // Record import history
  await supabase.from("import_history").insert({
    client_id: clientId,
    platform: csvData.platform,
    records_count: csvData.preview.totalRows,
    file_name: file.name,
    status: "completed",
    metadata: {
      columns: csvData.preview.columns,
      dateRange: csvData.preview.dateRange,
    },
  });

  setProgress(100);

  toast.success(`${csvData.preview.totalRows} registros importados com sucesso`);
  return {
    success: true,
    message: `Métricas de ${csvData.platform} importadas com sucesso`,
    data: { recordsImported: csvData.preview.totalRows },
  };
}

async function executeCreatePlanningCard(
  action: PendingAction,
  clientId: string,
  workspaceId: string
): Promise<ExecuteActionResult> {
  const { title, description, date, assignee } = action.params;

  // Get first column for the workspace
  const { data: columns, error: columnsError } = await supabase
    .from("kanban_columns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true })
    .limit(1);

  if (columnsError) throw columnsError;
  if (!columns || columns.length === 0) {
    return { success: false, message: "Nenhuma coluna encontrada no planejamento" };
  }

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { success: false, message: "Usuário não autenticado" };
  }

  const { data: card, error } = await supabase
    .from("planning_items")
    .insert({
      title: title || "Novo card",
      description,
      client_id: clientId,
      workspace_id: workspaceId,
      column_id: columns[0].id,
      due_date: date,
      assigned_to: assignee,
      created_by: user.user.id,
      status: "todo",
    })
    .select()
    .single();

  if (error) throw error;

  toast.success("Card criado no planejamento");
  return {
    success: true,
    message: "Card criado com sucesso",
    data: { cardId: card.id },
  };
}

async function executeUploadToLibrary(
  action: PendingAction,
  clientId: string
): Promise<ExecuteActionResult> {
  const { title, description, url } = action.params;
  const urlData = action.preview?.data as { content?: string; thumbnailUrl?: string } | undefined;

  const contentData = {
    client_id: clientId,
    title: title || "Novo conteúdo",
    content: urlData?.content || description || "",
    content_type: "instagram_post" as const,
    content_url: url,
    thumbnail_url: urlData?.thumbnailUrl,
  };

  const { data: content, error } = await supabase
    .from("client_content_library")
    .insert(contentData)
    .select()
    .single();

  if (error) throw error;

  toast.success("Conteúdo adicionado à biblioteca");
  return {
    success: true,
    message: "Conteúdo salvo na biblioteca",
    data: { contentId: content.id },
  };
}

async function executeUploadToReferences(
  action: PendingAction,
  clientId: string
): Promise<ExecuteActionResult> {
  const { title, url } = action.params;
  const urlData = action.preview?.data as { 
    content?: string; 
    thumbnailUrl?: string;
    type?: string;
  } | undefined;

  const referenceData = {
    client_id: clientId,
    title: title || "Nova referência",
    content: urlData?.content || "",
    source_url: url,
    thumbnail_url: urlData?.thumbnailUrl,
    reference_type: urlData?.type || "article",
  };

  const { data: reference, error } = await supabase
    .from("client_reference_library")
    .insert(referenceData)
    .select()
    .single();

  if (error) throw error;

  toast.success("Referência adicionada à biblioteca");
  return {
    success: true,
    message: "Referência salva com sucesso",
    data: { referenceId: reference.id },
  };
}

async function executeCreateContent(
  action: PendingAction,
  clientId: string
): Promise<ExecuteActionResult> {
  const { format, description } = action.params;

  const { data, error } = await supabase.functions.invoke("generate-content-from-idea", {
    body: {
      clientId,
      idea: description || "Criar conteúdo",
      format: format || "post",
    },
  });

  if (error) throw error;

  toast.success("Conteúdo gerado com sucesso");
  return {
    success: true,
    message: "Conteúdo criado",
    data: { content: data.content },
  };
}
