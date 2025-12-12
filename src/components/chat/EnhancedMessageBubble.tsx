import { cn } from "@/lib/utils";
import { User, Sparkles, ZoomIn, FileDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { MessageActions } from "@/components/MessageActions";
import { ArtifactCard, parseArtifacts, ArtifactType } from "./ArtifactCard";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

interface EnhancedMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[] | null;
  isGeneratedImage?: boolean;
  onRegenerate?: () => void;
  isLastMessage?: boolean;
  clientId?: string;
  clientName?: string;
  templateName?: string;
}

export const EnhancedMessageBubble = ({ 
  role, 
  content,
  imageUrls,
  isGeneratedImage,
  onRegenerate,
  isLastMessage,
  clientId,
  clientName,
  templateName,
}: EnhancedMessageBubbleProps) => {
  const isUser = role === "user";
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const { toast } = useToast();

  const hasImages = imageUrls && imageUrls.length > 0;
  const isSingleImage = hasImages && imageUrls.length === 1;
  const isMultipleImages = hasImages && imageUrls.length > 1;

  // Parse content for artifacts
  const { textContent, artifacts } = useMemo(() => {
    if (isUser) return { textContent: content, artifacts: [] };
    return parseArtifacts(content);
  }, [content, isUser]);

  // Check if this is a long-form content that could be a document
  const isLongFormContent = !isUser && content.length > 1500 && !artifacts.length;
  const hasStructuredContent = !isUser && (
    content.includes("# ") || 
    content.includes("## ") || 
    content.includes("---PÁGINA") ||
    content.includes("---SLIDE")
  );

  const handleDownloadAsPDF = async () => {
    try {
      const pdf = new jsPDF();
      const margin = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const maxWidth = pageWidth - margin * 2;
      
      // Title
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(clientName ? `Conteúdo - ${clientName}` : "Conteúdo Gerado", margin, margin + 10);
      
      // Content
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      const lines = pdf.splitTextToSize(content, maxWidth);
      let y = margin + 25;
      
      for (const line of lines) {
        if (y > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += 5;
      }
      
      pdf.save(`conteudo_${Date.now()}.pdf`);
      toast({ description: "PDF baixado com sucesso!" });
    } catch (error) {
      toast({ description: "Erro ao gerar PDF", variant: "destructive" });
    }
  };

  return (
    <>
      <div className={cn(
        "flex gap-3 px-4 py-4 animate-fade-in group",
        isUser ? "justify-end" : "justify-start"
      )}>
        {/* Avatar do assistente */}
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-card border border-primary/20 flex items-center justify-center">
            <img src={kaleidosLogo} alt="kAI" className="h-5 w-5 object-contain" />
          </div>
        )}
        
        <div className="flex flex-col gap-2 max-w-[85%]">
          {/* Imagens */}
          {hasImages && (
            <div className={cn(
              "relative",
              isUser ? "order-first" : "",
              isSingleImage ? "max-w-md" : "max-w-lg"
            )}>
              {/* Badge de imagem gerada */}
              {isGeneratedImage && !isUser && (
                <Badge 
                  variant="secondary" 
                  className="absolute -top-2 -left-2 z-10 text-[10px] bg-primary/90 text-primary-foreground"
                >
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  IA
                </Badge>
              )}
              
              <div className={cn(
                "grid gap-2",
                isMultipleImages && imageUrls.length === 2 && "grid-cols-2",
                isMultipleImages && imageUrls.length === 3 && "grid-cols-3",
                isMultipleImages && imageUrls.length >= 4 && "grid-cols-2"
              )}>
                {imageUrls.map((url, index) => (
                  <div 
                    key={index} 
                    className="relative group/img cursor-pointer overflow-hidden rounded-lg border border-border"
                    onClick={() => setLightboxImage(url)}
                  >
                    <img
                      src={url}
                      alt={isGeneratedImage ? "Imagem gerada por IA" : `Anexo ${index + 1}`}
                      className={cn(
                        "w-full h-auto object-cover transition-transform duration-200 group-hover/img:scale-105",
                        isSingleImage && "max-h-80",
                        isMultipleImages && "aspect-square object-cover"
                      )}
                    />
                    {/* Overlay de zoom */}
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artifacts (documentos, tabelas, etc) */}
          {artifacts.length > 0 && (
            <div className="space-y-2">
              {artifacts.map((artifact, index) => (
                <ArtifactCard
                  key={index}
                  type={artifact.type}
                  title={artifact.title}
                  content={artifact.content}
                  tableData={artifact.tableData}
                  slides={artifact.slides}
                />
              ))}
            </div>
          )}

          {/* Conteúdo de texto */}
          {textContent && (
            <div
              className={cn(
                "rounded-2xl px-4 py-3 break-words relative",
                isUser
                  ? "bg-muted border border-border"
                  : "bg-card border border-border"
              )}
            >
              {/* Quick download button for long content */}
              {(isLongFormContent || hasStructuredContent) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-2 h-7 px-2 bg-background border border-border shadow-sm hover:bg-muted"
                  onClick={handleDownloadAsPDF}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  <span className="text-[10px]">PDF</span>
                </Button>
              )}
              
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{textContent}</ReactMarkdown>
              </div>
            </div>
          )}
          
          {/* Ações */}
          <MessageActions 
            content={content}
            role={role}
            onRegenerate={onRegenerate}
            isLastMessage={isLastMessage}
            clientId={clientId}
            clientName={clientName}
            templateName={templateName}
          />
        </div>

        {/* Avatar do usuário */}
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
            <User className="h-4 w-4 text-foreground" />
          </div>
        )}
      </div>

      {/* Lightbox para visualização ampliada */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-background/95 backdrop-blur-sm">
          <DialogTitle className="sr-only">Visualização da imagem</DialogTitle>
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Imagem ampliada"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
