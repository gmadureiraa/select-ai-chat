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
  platform?: string; // Optional: filter by specific platform
}

export function ImportHistoryPanel({ clientId, platform }: ImportHistoryPanelProps) {
  const { imports, isLoading, deleteImport } = useImportHistory(clientId);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (isLoading) {
    return null;
  }

  // Filter by platform if provided
  const filteredImports = platform 
    ? imports.filter(imp => imp.platform === platform)
    : imports;

  const groupedImports = filteredImports.reduce((acc, imp) => {
    if (!acc[imp.platform]) {
      acc[imp.platform] = [];
    }
    acc[imp.platform].push(imp);
    return acc;
  }, {} as Record<string, typeof filteredImports>);

  const platforms = Object.keys(groupedImports);

  const importToDelete = confirmDelete 
    ? filteredImports.find(i => i.id === confirmDelete) 
    : null;

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Histórico de Importações</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {filteredImports.length}
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
              {/* Grouped by Platform */}
              {platforms.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma importação registrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {platforms.map((plat) => {
                    const PlatformIcon = platformIcons[plat] || FileSpreadsheet;
                    const platformImports = groupedImports[plat];
                    const totalRecords = platformImports.reduce((sum, i) => sum + i.records_count, 0);

                    return (
                      <div key={plat} className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <PlatformIcon className="h-4 w-4" />
                          <span className="font-medium text-sm">
                            {platformLabels[plat] || plat}
                          </span>
                          <Badge variant="outline" className={platformColors[plat]}>
                            {totalRecords.toLocaleString()} registros
                          </Badge>
                        </div>

                        <div className="space-y-1.5">
                          {platformImports.map((imp) => (
                            <div
                              key={imp.id}
                              className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/30"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-muted-foreground shrink-0">
                                  {format(new Date(imp.imported_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                                </span>
                                {imp.file_name && (
                                  <span className="text-foreground truncate">
                                    {imp.file_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
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
                                  {imp.status === "completed" ? "OK" : imp.status}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDelete(imp.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
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

      {/* Confirm Delete Import Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir importação
            </AlertDialogTitle>
            <AlertDialogDescription>
              {importToDelete && (
                <>
                  Deseja excluir a importação de{" "}
                  <strong>{platformLabels[importToDelete.platform] || importToDelete.platform}</strong>
                  {importToDelete.file_name && (
                    <> ({importToDelete.file_name})</>
                  )}
                  {" "}com <strong>{importToDelete.records_count}</strong> registros?
                  <br /><br />
                  <span className="text-muted-foreground">
                    Nota: Esta ação remove apenas o registro do histórico. Os dados já importados permanecerão no sistema.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  deleteImport.mutate(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
