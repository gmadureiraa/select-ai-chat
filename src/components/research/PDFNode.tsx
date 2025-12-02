import { memo, useState, useRef } from "react";
import { FileText, Upload, Eye, Loader2 } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Button } from "@/components/ui/button";
import { useResearchItems, ResearchItem } from "@/hooks/useResearchItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PDFNodeProps {
  id: string;
  data: {
    item: ResearchItem;
    onDelete: (id: string) => void;
    projectId: string;
    isConnected?: boolean;
  };
}

export const PDFNode = memo(({ id, data }: PDFNodeProps) => {
  const { item, onDelete, projectId, isConnected } = data;
  const { updateItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie um arquivo PDF.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileName = `${projectId}/${id}/${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("research-files")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("research-files")
        .getPublicUrl(fileName);

      // Extract text from PDF using edge function
      toast({ title: "Extraindo texto do PDF...", description: "Isso pode levar alguns segundos." });

      const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-pdf", {
        body: { fileUrl: urlData.publicUrl, fileName: file.name },
      });

      // Update item with file info and extracted content
      await updateItem.mutateAsync({
        id,
        title: file.name,
        file_path: fileName,
        source_url: urlData.publicUrl,
        content: extractData?.content || "Conteúdo não extraído",
        metadata: {
          fileSize: file.size,
          pageCount: extractData?.pageCount || 0,
          extractedAt: new Date().toISOString(),
        },
        processed: true,
      });

      toast({ title: "PDF adicionado", description: `${extractData?.pageCount || 0} páginas processadas.` });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro ao processar PDF",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const hasContent = item.content && item.content.length > 0;
  const pageCount = item.metadata?.pageCount || 0;

  return (
    <BaseNode
      id={id}
      onDelete={onDelete}
      icon={FileText}
      iconColor="text-rose-500"
      bgColor="bg-rose-500/10"
      borderColor="border-rose-500/30"
      label="PDF"
      title={item.title || "PDF"}
      isConnected={isConnected}
      className="w-72"
      badge={
        pageCount > 0 && (
          <span className="text-xs px-2 py-0.5 bg-rose-500/10 text-rose-500 rounded-md">
            {pageCount} páginas
          </span>
        )
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {!hasContent ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Enviar PDF
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground line-clamp-3">
            {item.content?.slice(0, 200)}...
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowContent(true)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver conteúdo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showContent} onOpenChange={setShowContent}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{item.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
              {item.content}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </BaseNode>
  );
});

PDFNode.displayName = "PDFNode";
