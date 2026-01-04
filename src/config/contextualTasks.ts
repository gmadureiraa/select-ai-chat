export type TaskStatus = "pending" | "running" | "completed" | "error";

export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  detail?: string;
}

export type ContextType = 
  | "assistant"
  | "assistant-simple"
  | "assistant-library"
  | "assistant-multi-agent"
  | "social-publisher"
  | "knowledge-base"
  | "performance"
  | "automations";

export const CONTEXTUAL_TASKS: Record<ContextType, Omit<Task, "status">[]> = {
  "assistant": [
    { id: "analyze", label: "Analisando pergunta" },
    { id: "search", label: "Buscando contexto" },
    { id: "generate", label: "Gerando resposta" },
  ],
  "assistant-simple": [
    { id: "analyze", label: "Analisando pergunta" },
    { id: "generate", label: "Gerando resposta" },
  ],
  "assistant-library": [
    { id: "analyze", label: "Analisando pergunta" },
    { id: "search-library", label: "Buscando na biblioteca" },
    { id: "search-references", label: "Analisando referências" },
    { id: "generate", label: "Gerando conteúdo" },
    { id: "format", label: "Formatando resultado" },
  ],
  "assistant-multi-agent": [
    { id: "analyze", label: "Analisando pedido" },
    { id: "search-library", label: "Buscando na biblioteca" },
    { id: "agent-researcher", label: "Agente Pesquisador" },
    { id: "agent-writer", label: "Agente Escritor" },
    { id: "agent-editor", label: "Agente Editor de Estilo" },
    { id: "agent-reviewer", label: "Agente Revisor" },
    { id: "format", label: "Finalizando conteúdo" },
  ],
  "social-publisher": [
    { id: "validate", label: "Validando conteúdo" },
    { id: "prepare", label: "Preparando publicação" },
    { id: "publish-twitter", label: "Publicando no Twitter/X" },
    { id: "publish-linkedin", label: "Publicando no LinkedIn" },
    { id: "save", label: "Salvando na biblioteca" },
  ],
  "knowledge-base": [
    { id: "upload", label: "Recebendo arquivo" },
    { id: "extract", label: "Extraindo conteúdo" },
    { id: "categorize", label: "Categorizando" },
    { id: "save", label: "Salvando no sistema" },
  ],
  "performance": [
    { id: "load", label: "Carregando métricas" },
    { id: "process", label: "Processando dados" },
    { id: "insights", label: "Gerando insights" },
    { id: "update", label: "Atualizando dashboard" },
  ],
  "automations": [
    { id: "prepare", label: "Preparando automação" },
    { id: "execute", label: "Executando" },
    { id: "process", label: "Processando resultado" },
    { id: "complete", label: "Finalizando" },
  ],
};

export function getTasksForContext(context: ContextType): Task[] {
  const taskDefinitions = CONTEXTUAL_TASKS[context] || CONTEXTUAL_TASKS["assistant"];
  return taskDefinitions.map(task => ({
    ...task,
    status: "pending" as TaskStatus,
  }));
}
