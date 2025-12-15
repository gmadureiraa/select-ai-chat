import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientDocuments, ClientDocument } from "@/hooks/useClientDocuments";
import { getSignedUrl } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Image, 
  File, 
  Trash2, 
  Upload, 
  Loader2,
  Download,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClientDocumentsManagerProps {
  clientId: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType.includes("image")) return <Image className="h-4 w-4 text-blue-500" />;
  if (fileType.includes("word") || fileType.includes("doc")) return <FileText className="h-4 w-4 text-blue-600" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

const getFileTypeLabel = (fileType: string) => {
  if (fileType.includes("pdf")) return "PDF";
  if (fileType.includes("image")) return "Imagem";
  if (fileType.includes("word") || fileType.includes("doc")) return "Word";
  if (fileType.includes("text")) return "Texto";
  return "Arquivo";
};

export const ClientDocumentsManager = ({ clientId }: ClientDocumentsManagerProps) => {
  const { documents, isLoading, uploadDocument, deleteDocument } = useClientDocuments(clientId);
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ClientDocument | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<ClientDocument | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      await uploadDocument.mutateAsync(file);
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteDocument.mutateAsync(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    setIsDownloading(doc.id);
    try {
      const signedUrl = await getSignedUrl(doc.file_path);
      if (signedUrl) {
        // Open in new tab for viewing/downloading
        window.open(signedUrl, "_blank");
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível gerar o link do arquivo.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Upload de Documentos</Label>
        <p className="text-xs text-muted-foreground">
          PDFs, imagens e documentos serão automaticamente transcritos e disponibilizados para o Assistente kAI
        </p>
        
        <div className="flex gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
            id="doc-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadDocument.isPending}
            className="w-full gap-2"
          >
            {uploadDocument.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadDocument.isPending ? "Enviando e transcrevendo..." : "Selecionar arquivos"}
          </Button>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="space-y-2">
          <Label>Documentos ({documents.length})</Label>
          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-2 space-y-2">
              {documents.map((doc) => (
                <Collapsible 
                  key={doc.id}
                  open={expandedDoc === doc.id}
                  onOpenChange={(open) => setExpandedDoc(open ? doc.id : null)}
                >
                  <div className="rounded-lg border bg-card">
                    <div className="flex items-center gap-3 p-3">
                      {getFileIcon(doc.file_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getFileTypeLabel(doc.file_type)}
                          </Badge>
                          {doc.extracted_content && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Transcrito
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {/* Download/View button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(doc)}
                          disabled={isDownloading === doc.id}
                          title="Abrir/Baixar arquivo"
                        >
                          {isDownloading === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                        </Button>
                        
                        {/* View extracted content */}
                        {doc.extracted_content && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver conteúdo extraído">
                              {expandedDoc === doc.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(doc)}
                          title="Remover documento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <CollapsibleContent>
                      {doc.extracted_content && (
                        <div className="px-3 pb-3 border-t pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs text-muted-foreground">
                              Conteúdo Extraído:
                            </Label>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs gap-1"
                              onClick={() => setViewingDoc(doc)}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver completo
                            </Button>
                          </div>
                          <ScrollArea className="h-[150px]">
                            <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-md font-mono">
                              {doc.extracted_content.substring(0, 1000)}
                              {doc.extracted_content.length > 1000 && "..."}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {documents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum documento adicionado</p>
          <p className="text-xs mt-1">Adicione PDFs, imagens ou documentos para o contexto do cliente</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento "{deleteTarget?.name}" será removido permanentemente do contexto do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full content view dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingDoc && getFileIcon(viewingDoc.file_type)}
              {viewingDoc?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-2">
            {viewingDoc && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => handleDownload(viewingDoc)}
              >
                <Download className="h-4 w-4" />
                Baixar original
              </Button>
            )}
          </div>
          <ScrollArea className="h-[60vh]">
            <pre className="text-sm whitespace-pre-wrap bg-muted/50 p-4 rounded-md font-mono">
              {viewingDoc?.extracted_content || "Sem conteúdo extraído."}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
