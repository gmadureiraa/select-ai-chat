import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  History, 
  Trash2, 
  FileSpreadsheet, 
  Instagram, 
  Youtube, 
  Mail,
  Twitter,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useImportHistory } from "@/hooks/useImportHistory";

const platformIcons: Record<string, typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
  newsletter: Mail,
  twitter: Twitter,
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  newsletter: "Newsletter",
  twitter: "Twitter",
  tiktok: "TikTok",
};

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  youtube: "bg-red-500/10 text-red-500 border-red-500/20",
  newsletter: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  twitter: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  tiktok: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

interface ImportHistoryPanelProps {
  clientId: string;
}

export function ImportHistoryPanel({ clientId }: ImportHistoryPanelProps) {
  const { imports, isLoading, deleteImport, clearPlatformData, clearAllData } = useImportHistory(clientId);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (isLoading) {
    return null;
  }

  const groupedImports = imports.reduce((acc, imp) => {
    if (!acc[imp.platform]) {
      acc[imp.platform] = [];
    }
    acc[imp.platform].push(imp);
    return acc;
  }, {} as Record<string, typeof imports>);

  const platforms = Object.keys(groupedImports);

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Histórico de Importações</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {imports.length} importações
                  </Badge>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Clear All Button */}
              {imports.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmClearAll(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Limpar Todos os Dados
                  </Button>
                </div>
              )}

              {/* Grouped by Platform */}
              {platforms.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma importação registrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {platforms.map((platform) => {
                    const PlatformIcon = platformIcons[platform] || FileSpreadsheet;
                    const platformImports = groupedImports[platform];
                    const totalRecords = platformImports.reduce((sum, i) => sum + i.records_count, 0);

                    return (
                      <div key={platform} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <PlatformIcon className="h-4 w-4" />
                            <span className="font-medium text-sm">
                              {platformLabels[platform] || platform}
                            </span>
                            <Badge variant="outline" className={platformColors[platform]}>
                              {totalRecords.toLocaleString()} registros
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmClear(platform)}
                            className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Limpar
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          {platformImports.slice(0, 5).map((imp) => (
                            <div
                              key={imp.id}
                              className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/30"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  {format(new Date(imp.imported_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                </span>
                                {imp.file_name && (
                                  <span className="text-foreground truncate max-w-[150px]">
                                    {imp.file_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] px-1.5">
                                  {imp.records_count} registros
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={
                                    imp.status === "completed"
                                      ? "bg-green-500/10 text-green-500 border-green-500/20 text-[10px] px-1.5"
                                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px] px-1.5"
                                  }
                                >
                                  {imp.status === "completed" ? "Completo" : imp.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                          {platformImports.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center pt-1">
                              +{platformImports.length - 5} importações anteriores
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Confirm Clear Platform Dialog */}
      <AlertDialog open={!!confirmClear} onOpenChange={() => setConfirmClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limpar dados de {platformLabels[confirmClear || ""] || confirmClear}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover permanentemente todos os dados de performance e histórico de importação desta plataforma. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmClear) {
                  clearPlatformData.mutate({ clientId, platform: confirmClear });
                  setConfirmClear(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar Dados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Clear All Dialog */}
      <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limpar TODOS os dados de performance
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover permanentemente TODOS os dados de performance de TODAS as plataformas (Instagram, YouTube, Newsletter, etc.) e todo o histórico de importações. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllData.mutate(clientId);
                setConfirmClearAll(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar Todos os Dados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
