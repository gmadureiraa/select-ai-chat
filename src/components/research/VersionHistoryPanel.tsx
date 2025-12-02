import { useState } from "react";
import { useResearchVersions, ProjectVersion } from "@/hooks/useResearchVersions";
import { useResearchItems } from "@/hooks/useResearchItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  History,
  Save,
  RotateCcw,
  Trash2,
  Clock,
  FileStack,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VersionHistoryPanelProps {
  projectId: string;
}

export const VersionHistoryPanel = ({ projectId }: VersionHistoryPanelProps) => {
  const { versions, createVersion, restoreVersion, deleteVersion } = useResearchVersions(projectId);
  const { items, connections } = useResearchItems(projectId);
  
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState<ProjectVersion | null>(null);

  const handleSaveVersion = () => {
    createVersion.mutate({
      name: versionName || undefined,
      description: versionDescription || undefined,
      items: items || [],
      connections: connections || [],
    });
    setShowSaveDialog(false);
    setVersionName("");
    setVersionDescription("");
  };

  const handleRestore = (version: ProjectVersion) => {
    setRestoreConfirm(version);
  };

  const confirmRestore = () => {
    if (restoreConfirm) {
      restoreVersion.mutate(restoreConfirm);
      setRestoreConfirm(null);
    }
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
            {versions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {versions.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Versões
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Save current version button */}
            <Button 
              className="w-full gap-2" 
              onClick={() => setShowSaveDialog(true)}
              disabled={!items || items.length === 0}
            >
              <Save className="h-4 w-4" />
              Salvar Versão Atual
            </Button>

            {/* Versions list */}
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-3 pr-4">
                {versions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileStack className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma versão salva</p>
                    <p className="text-xs mt-1">
                      Salve versões para manter um histórico do seu projeto
                    </p>
                  </div>
                ) : (
                  versions.map((version) => (
                    <VersionCard
                      key={version.id}
                      version={version}
                      onRestore={() => handleRestore(version)}
                      onDelete={() => deleteVersion.mutate(version.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Save version dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Nova Versão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da versão (opcional)</Label>
              <Input
                placeholder="Ex: Antes de reestruturar"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva as principais mudanças..."
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Esta versão conterá {items?.length || 0} itens e {connections?.length || 0} conexões
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveVersion} disabled={createVersion.isPending}>
              {createVersion.isPending ? "Salvando..." : "Salvar Versão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Versão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja restaurar "{restoreConfirm?.name}"? 
              Esta ação substituirá todos os itens atuais do projeto. 
              Considere salvar uma versão antes de restaurar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

interface VersionCardProps {
  version: ProjectVersion;
  onRestore: () => void;
  onDelete: () => void;
}

const VersionCard = ({ version, onRestore, onDelete }: VersionCardProps) => {
  const itemCount = version.snapshot?.items?.length || 0;
  const connectionCount = version.snapshot?.connections?.length || 0;

  return (
    <div className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{version.name || `Versão ${version.version_number}`}</h4>
          {version.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {version.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(version.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
            <Badge variant="secondary" className="text-xs">
              {itemCount} itens
            </Badge>
            <Badge variant="outline" className="text-xs">
              {connectionCount} conexões
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={onRestore}>
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
