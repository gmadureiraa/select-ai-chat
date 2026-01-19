import { useState } from "react";
import { History, ChevronDown, RotateCcw, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export interface ContentVersion {
  id: string;
  content: string;
  createdAt: string;
  label?: string;
}

interface VersionHistoryProps {
  versions: ContentVersion[];
  currentContent: string;
  onRestore: (version: ContentVersion) => void;
  onClear?: () => void;
  maxVersions?: number;
}

export function VersionHistory({
  versions,
  currentContent,
  onRestore,
  onClear,
  maxVersions = 5,
}: VersionHistoryProps) {
  const [previewVersion, setPreviewVersion] = useState<ContentVersion | null>(null);

  if (versions.length === 0) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", { 
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 px-2"
          >
            <History className="h-3 w-3" />
            <span className="hidden sm:inline">{versions.length}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Versões Anteriores</span>
            <Badge variant="secondary" className="text-[10px] h-4">
              {versions.length}/{maxVersions}
            </Badge>
          </div>
          <DropdownMenuSeparator />
          {versions.slice(0, maxVersions).map((version, idx) => (
            <DropdownMenuItem
              key={version.id}
              className="flex items-center justify-between group cursor-pointer"
              onClick={() => setPreviewVersion(version)}
            >
              <div className="flex flex-col">
                <span className="text-xs font-medium">
                  {version.label || `Versão ${versions.length - idx}`}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(version.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewVersion(version);
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore(version);
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}
          {onClear && versions.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onClear}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Limpar histórico
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Preview Dialog */}
      <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {previewVersion?.label || "Versão Anterior"}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {previewVersion && formatFullDate(previewVersion.createdAt)}
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {previewVersion && (
                <ReactMarkdown>{previewVersion.content}</ReactMarkdown>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewVersion(null)}
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (previewVersion) {
                  onRestore(previewVersion);
                  setPreviewVersion(null);
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Esta Versão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
