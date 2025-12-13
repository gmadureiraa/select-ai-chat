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
        "flex gap-3 px-4 py-3 group transition-colors hover:bg-muted/20",
        isUser ? "justify-end" : "justify-start"
      )}>
        {/* Avatar do assistente */}
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 flex items-center justify-center mt-0.5">
            <img src={kaleidosLogo} alt="kAI" className="h-4 w-4 object-contain" />
          </div>
        )}
        
        <div className="flex flex-col gap-2 max-w-[85%] min-w-0">
          {/* Imagens */}
          {hasImages && (
            <div className={cn(
              "relative",
              isUser ? "order-first" : "",
              isSingleImage ? "max-w-sm" : "max-w-md"
            )}>
              {/* Badge de imagem gerada */}
              {isGeneratedImage && !isUser && (
                <Badge 
                  variant="secondary" 
                  className="absolute -top-1.5 -left-1.5 z-10 text-[9px] h-5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0"
                >
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  IA
                </Badge>
              )}
              
              <div className={cn(
                "grid gap-1.5",
                isMultipleImages && imageUrls.length === 2 && "grid-cols-2",
                isMultipleImages && imageUrls.length === 3 && "grid-cols-3",
                isMultipleImages && imageUrls.length >= 4 && "grid-cols-2"
              )}>
                {imageUrls.map((url, index) => (
                  <div 
                    key={index} 
                    className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-border/50"
                    onClick={() => setLightboxImage(url)}
                  >
                    <img
                      src={url}
                      alt={isGeneratedImage ? "Imagem gerada por IA" : `Anexo ${index + 1}`}
                      className={cn(
                        "w-full h-auto object-cover transition-transform duration-300 group-hover/img:scale-105",
                        isSingleImage && "max-h-72",
                        isMultipleImages && "aspect-square object-cover"
                      )}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
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
                  ? "bg-primary/5 border border-primary/10"
                  : "bg-card border border-border/50"
              )}
            >
              {/* Quick download button for long content */}
              {(isLongFormContent || hasStructuredContent) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 px-2 bg-card border border-border/60 shadow-sm hover:bg-muted text-[9px] rounded-lg"
                  onClick={handleDownloadAsPDF}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  PDF
                </Button>
              )}
              
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed 
                [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 
                [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5
                [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                [&_strong]:font-semibold [&_strong]:text-foreground
                [&_em]:italic
                [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto
                [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_hr]:border-border [&_hr]:my-4
                [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
              ">
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
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-muted border border-border/50 flex items-center justify-center mt-0.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Lightbox para visualização ampliada */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-background/95 backdrop-blur-lg border-border/50">
          <DialogTitle className="sr-only">Visualização da imagem</DialogTitle>
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Imagem ampliada"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
