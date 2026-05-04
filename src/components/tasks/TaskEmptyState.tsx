import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskEmptyStateProps {
  onCreate?: () => void;
  title?: string;
  description?: string;
  filtered?: boolean;
}

export function TaskEmptyState({
  onCreate,
  title,
  description,
  filtered,
}: TaskEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <CheckSquare className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-base font-semibold mb-1">
        {title ?? (filtered ? "Nenhuma tarefa encontrada" : "Sem tarefas por aqui")}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-5">
        {description ??
          (filtered
            ? "Tente limpar os filtros ou ajustar a busca."
            : "Crie tarefas internas do time — checklist, responsáveis, prazos e comentários, tudo em um só lugar.")}
      </p>
      {onCreate && !filtered && (
        <Button onClick={onCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Criar primeira tarefa
        </Button>
      )}
    </div>
  );
}
