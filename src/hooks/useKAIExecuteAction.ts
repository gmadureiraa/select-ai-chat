import { useState, useCallback } from "react";
import {
  KAIActionType,
  PendingAction,
  CSVAnalysisResult
} from "@/types/kaiActions";
import { apiInvoke } from '../lib/apiInvoke';
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
  const { data, error } = await apiInvoke("validate-csv-import", {
    body: {
      clientId,
      platform: csvData.platform,
      csvContent: content,
    },
  });

  if (error) throw error;

  setProgress(80);

  // Record import history via handler (P0 fix audit 2026-05-17 —
  // assertClientAccess centralizado).
  await apiInvoke("import-history-create", {
    body: {
      client_id: clientId,
      platform: csvData.platform,
      records_count: csvData.preview.totalRows,
      file_name: file.name,
      status: "completed",
      metadata: {
        columns: csvData.preview.columns,
        dateRange: csvData.preview.dateRange,
      },
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

  // P0 fix audit 2026-05-17: troca insert direto por /api/planning-items-create
  // (handler resolve coluna 'first position' no servidor + valida workspace +
  // client access). created_by é forçado pelo auth do handler.
  const { data, error } = await apiInvoke("planning-items-create", {
    body: {
      title: title || "Novo card",
      description,
      client_id: clientId,
      workspace_id: workspaceId,
      due_date: date,
      assigned_to: assignee,
      status: "todo",
    },
  });

  if (error) throw new Error(error.message || "Erro ao criar card");

  const card = data?.item ?? data;
  toast.success("Card criado no planejamento");
  return {
    success: true,
    message: "Card criado com sucesso",
    data: { cardId: card?.id },
  };
}

async function executeUploadToLibrary(
  action: PendingAction,
  clientId: string
): Promise<ExecuteActionResult> {
  const { title, description, url } = action.params;
  const urlData = action.preview?.data as { content?: string; thumbnailUrl?: string } | undefined;

  // P0 fix audit 2026-05-17: troca insert direto por /api/save-to-library
  // (destination='content' → escreve em client_content_library).
  const { data, error } = await apiInvoke("save-to-library", {
    body: {
      client_id: clientId,
      title: title || "Novo conteúdo",
      content: urlData?.content || description || "",
      source_url: url,
      thumbnail_url: urlData?.thumbnailUrl,
      destination: "content",
      // format mapeia pra content_type via FORMAT_TO_CONTENT_TYPE no handler.
      // Para URLs do Instagram queremos content_type = instagram_post; o handler
      // mapeia 'static' → 'static_image'. Como instagram_post não está no enum
      // do handler, deixamos default e gravamos a origem nos metadata.
      format: "static",
      metadata: { source: "kai-chat-upload", original_url: url },
    },
  });

  if (error) throw new Error(error.message || "Erro ao salvar conteúdo");
  const content = data?.item ?? data;

  toast.success("Conteúdo adicionado à biblioteca");
  return {
    success: true,
    message: "Conteúdo salvo na biblioteca",
    data: { contentId: content?.id },
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

  // P0 fix audit 2026-05-17: troca insert direto por /api/save-to-library
  // (destination='references'). reference_type vem do handler via format
  // mapping; passamos `article` como hint default.
  const formatHint = (urlData?.type as
    | "carousel" | "reel" | "static" | "tweet" | "thread" | "newsletter" | "article" | "email"
    | undefined) || "article";
  const { data, error } = await apiInvoke("save-to-library", {
    body: {
      client_id: clientId,
      title: title || "Nova referência",
      content: urlData?.content || "",
      source_url: url,
      thumbnail_url: urlData?.thumbnailUrl,
      destination: "references",
      format: formatHint,
      metadata: { source: "kai-chat-references" },
    },
  });

  if (error) throw new Error(error.message || "Erro ao salvar referência");
  const reference = data?.item ?? data;

  toast.success("Referência adicionada à biblioteca");
  return {
    success: true,
    message: "Referência salva com sucesso",
    data: { referenceId: reference?.id },
  };
}

async function executeCreateContent(
  action: PendingAction,
  clientId: string
): Promise<ExecuteActionResult> {
  const { format, description } = action.params;

  const { data, error } = await apiInvoke("unified-content-api", {
    body: {
      clientId,
      title: description || "Criar conteúdo",
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
