import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, Link, Calendar, Library, CheckCircle2 } from "lucide-react";
import { PendingAction, KAIActionType } from "@/types/kaiActions";

interface ActionConfirmationDialogProps {
  pendingAction: PendingAction | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const ACTION_CONFIG: Record<
  KAIActionType,
  { title: string; icon: React.ElementType; color: string }
> = {
  upload_metrics: {
    title: "Importar Métricas",
    icon: FileSpreadsheet,
    color: "text-blue-500",
  },
  create_planning_card: {
    title: "Criar Card no Planejamento",
    icon: Calendar,
    color: "text-purple-500",
  },
  upload_to_library: {
    title: "Adicionar à Biblioteca",
    icon: Library,
    color: "text-green-500",
  },
  upload_to_references: {
    title: "Adicionar às Referências",
    icon: Link,
    color: "text-amber-500",
  },
  create_content: {
    title: "Criar Conteúdo",
    icon: CheckCircle2,
    color: "text-primary",
  },
  ask_about_metrics: {
    title: "Consultar Métricas",
    icon: FileSpreadsheet,
    color: "text-blue-500",
  },
  analyze_url: {
    title: "Analisar URL",
    icon: Link,
    color: "text-amber-500",
  },
  general_chat: {
    title: "Conversa",
    icon: CheckCircle2,
    color: "text-muted-foreground",
  },
};

export function ActionConfirmationDialog({
  pendingAction,
  onConfirm,
  onCancel,
}: ActionConfirmationDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!pendingAction) return null;

  const config = ACTION_CONFIG[pendingAction.type];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={!!pendingAction} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {pendingAction.preview?.description || "Confirme a ação abaixo"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview Title */}
          {pendingAction.preview?.title && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Título</p>
              <p className="text-sm">{pendingAction.preview.title}</p>
            </div>
          )}

          {/* Action Parameters */}
          {Object.keys(pendingAction.params).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Detalhes</p>
              <div className="flex flex-wrap gap-2">
                {pendingAction.params.clientName && (
                  <Badge variant="secondary">
                    Cliente: {pendingAction.params.clientName}
                  </Badge>
                )}
                {pendingAction.params.format && (
                  <Badge variant="secondary">
                    Formato: {pendingAction.params.format}
                  </Badge>
                )}
                {pendingAction.params.platform && (
                  <Badge variant="secondary">
                    Plataforma: {pendingAction.params.platform}
                  </Badge>
                )}
                {pendingAction.params.date && (
                  <Badge variant="secondary">
                    Data: {pendingAction.params.date}
                  </Badge>
                )}
                {pendingAction.params.assignee && (
                  <Badge variant="secondary">
                    Responsável: {pendingAction.params.assignee}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* URL Preview */}
          {pendingAction.params.url && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">URL</p>
              <p className="text-sm text-primary truncate">
                {pendingAction.params.url}
              </p>
            </div>
          )}

          {/* Files Preview */}
          {pendingAction.files && pendingAction.files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Arquivos</p>
              <div className="space-y-1">
                {pendingAction.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Data */}
          {pendingAction.preview?.data && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Preview</p>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(pendingAction.preview.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isConfirming}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
