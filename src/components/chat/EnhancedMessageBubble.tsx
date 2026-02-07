import { cn } from "@/lib/utils";
import { User, Sparkles, ZoomIn, FileDown, FileText, BookOpen, Wand2, Lightbulb, RefreshCw, CalendarPlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";
import { MessageActions } from "@/components/MessageActions";
import { ArtifactCard, parseArtifacts, ArtifactType } from "./ArtifactCard";
import { ImageActionButtons } from "./ImageActionButtons";
import { AddToPlanningButton } from "./AddToPlanningButton";
import { AdjustImageButton } from "./AdjustImageButton";
import { ResponseCard, hasResponseCardPayload, ResponseCardPayload } from "./ResponseCard";
import { SourcesBadge, ValidationBadge } from "./SourcesBadge";
import { MessageFeedback } from "./MessageFeedback";
import { useState, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { PostPreviewCard } from "@/components/posts";
import { parseContentForPosts } from "@/lib/postDetection";
import { Citation } from "@/components/chat/CitationChip";
import { MessagePayload } from "@/types/chat";

interface EnhancedMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[] | null;
  payload?: MessagePayload | null;
  isGeneratedImage?: boolean;
  onRegenerate?: () => void;
  isLastMessage?: boolean;
  clientId?: string;
  clientName?: string;
  templateName?: string;
  onSendMessage?: (content: string, images?: string[], quality?: "fast" | "high") => void;
  /** Disable auto-detection of social posts - useful for global chat context */
  disableAutoPostDetection?: boolean;
  /** Hide content action buttons - useful for non-content contexts */
  hideContentActions?: boolean;
  /** Message ID for feedback tracking */
  messageId?: string;
  /** Callback for saving content to library */
  onSaveToLibrary?: (content: string) => void;
  /** Callback when user clicks "Use" - opens planning dialog with content */
  onUseContent?: (content: string) => void;
  /** Whether the user has access to planning features */
  hasPlanningAccess?: boolean;
}

// Helper to get citation icon
const getCitationIcon = (citation: Citation) => {
  if (citation.category === "ideias") return Lightbulb;
  if (citation.type === "format") return Wand2;
  if (citation.type === "reference_library") return BookOpen;
  return FileText;
};

// Helper to get citation color class
const getCitationColorClass = (citation: Citation) => {
  if (citation.category === "ideias") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  if (citation.type === "format") return "bg-primary/10 text-primary border-primary/20";
  if (citation.type === "reference_library") return "bg-slate-500/10 text-slate-600 border-slate-500/20";
  return "bg-blue-500/10 text-blue-600 border-blue-500/20";
};

export const EnhancedMessageBubble = memo(function EnhancedMessageBubble({ 
  role, 
  content,
  imageUrls,
  payload,
  isGeneratedImage,
  onRegenerate,
  isLastMessage,
  clientId,
  clientName,
  templateName,
  onSendMessage,
  disableAutoPostDetection = false,
  hideContentActions = false,
  messageId,
  onSaveToLibrary,
  onUseContent,
  hasPlanningAccess = false,
}: EnhancedMessageBubbleProps) {
  const isUser = role === "user";
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const hasImages = imageUrls && imageUrls.length > 0;
  const isSingleImage = hasImages && imageUrls.length === 1;
  const isMultipleImages = hasImages && imageUrls.length > 1;

  // Extract citations from payload
  const citations = payload?.citations || [];

  // Check if this message has a ResponseCard payload
  const responseCardPayload = useMemo(() => {
    if (payload && hasResponseCardPayload({ payload })) {
      return payload as unknown as ResponseCardPayload;
    }
    return null;
  }, [payload]);

  // Parse content for artifacts
  const { textContent, artifacts } = useMemo(() => {
    if (isUser) return { textContent: content, artifacts: [] };
    return parseArtifacts(content);
  }, [content, isUser]);


  // Check if this is a generated image message
  const isGeneratedImageMessage = !isUser && hasImages && (content.includes("Imagem gerada") || isGeneratedImage);

  // Check if this is a long-form content that could be a document
  const isLongFormContent = !isUser && content.length > 1500 && !artifacts.length;
  const hasStructuredContent = !isUser && (
    content.includes("# ") || 
    content.includes("## ")
  );

  const handleAdjustImage = (prompt: string) => {
    if (onSendMessage && hasImages) {
      // Send the adjustment request with the current image as reference
      onSendMessage(prompt, imageUrls || undefined, "high");
    }
  };

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

  const handleGenerateImage = (prompt: string) => {
    if (onSendMessage) {
      onSendMessage(prompt, undefined, "high");
    }
  };

  const handleRequestIdeas = (prompt: string) => {
    if (onSendMessage) {
      onSendMessage(prompt, undefined, "fast");
    }
  };

  return (
    <>
      <div className={cn(
        "flex gap-3 py-4 group transition-all duration-200 animate-in fade-in slide-in-from-bottom-2",
        isUser ? "justify-end" : "justify-start"
      )}>
        {/* Avatar do assistente */}
        {!isUser && (
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mt-0.5 shadow-sm">
            <img src={kaleidosLogo} alt="kAI" className="h-5 w-5 object-contain" />
          </div>
        )}
        
        {/* Main content container - properly constrained */}
        <div className={cn(
          "flex flex-col gap-3 min-w-0",
          isUser ? "max-w-[80%]" : "max-w-[calc(100%-3.5rem)]",
          !isUser && "flex-1"
        )}>
          {/* Imagens */}
          {hasImages && (
            <div className={cn(
              "relative",
              isUser ? "order-first" : "",
              isSingleImage ? "max-w-sm" : "max-w-md"
            )}>
              {/* Badge de imagem gerada */}
              {isGeneratedImageMessage && (
                <Badge 
                  variant="secondary" 
                  className="absolute -top-1.5 -left-1.5 z-10 text-[9px] h-5 bg-muted text-muted-foreground border border-border/50"
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
                    className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-border"
                    onClick={() => setLightboxImage(url)}
                  >
                    <img
                      src={url}
                      alt={isGeneratedImageMessage ? "Imagem gerada por IA" : `Anexo ${index + 1}`}
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

              {/* Adjust image button for generated images */}
              {isGeneratedImageMessage && onSendMessage && (
                <div className="mt-2">
                  <AdjustImageButton 
                    imageUrl={imageUrls[0]} 
                    onAdjust={handleAdjustImage}
                  />
                </div>
              )}
            </div>
          )}

          {/* Sources Badge - Show which sources were used for this response */}
          {!isUser && payload?.sources_used && (
            <SourcesBadge sources={payload.sources_used} variant="inline" />
          )}

          {/* Response Card (for structured responses like cards_created) */}
          {responseCardPayload && (
            <ResponseCard 
              payload={responseCardPayload} 
              onViewPlanning={() => navigate(`?tab=planning`)}
            />
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

          {/* Conteúdo de texto - with proper overflow handling */}
          {textContent && (
            <div
              className={cn(
                "relative rounded-2xl px-4 py-3.5 transition-all duration-200",
                "w-full min-w-0",
                isUser
                  ? "bg-primary/8 border border-primary/15"
                  : "bg-muted/30 border border-border/40"
              )}
            >
              {/* Quick download button for long content */}
              {(isLongFormContent || hasStructuredContent) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 px-2 bg-card border border-border shadow-sm hover:bg-muted text-[9px] rounded-lg z-10"
                  onClick={handleDownloadAsPDF}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  PDF
                </Button>
              )}
              
              {/* Prose container with forced text wrapping */}
              <div 
                className="prose prose-sm dark:prose-invert text-sm leading-relaxed w-full
                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 
                  [&_p]:my-2.5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5
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
                  [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:break-all
                  [&_p]:break-words [&_li]:break-words [&_td]:break-words
                  [&>*]:max-w-full
                "
                style={{
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  maxWidth: '100%',
                }}
              >
                <ReactMarkdown
                  components={{
                    // Force all text to wrap properly
                    p: ({ children }) => (
                      <p style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{children}</p>
                    ),
                    li: ({ children }) => (
                      <li style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{children}</li>
                    ),
                    img: ({ src, alt }) => (
                      <img 
                        src={src} 
                        alt={alt || "Imagem"} 
                        className="max-w-full h-auto rounded-lg border border-border/50 my-2 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => src && setLightboxImage(src)}
                      />
                    ),
                  }}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-1 flex-wrap">
            <MessageActions 
              content={content}
              role={role}
              onRegenerate={onRegenerate}
              isLastMessage={isLastMessage}
              clientId={clientId}
              clientName={clientName}
              templateName={templateName}
              messageId={payload?.messageId || messageId}
            />
          </div>

          {/* Validation Badge - Shows if content was validated/repaired */}
          {!isUser && payload?.validation && (
            <ValidationBadge 
              passed={payload.validation.passed}
              repaired={payload.validation.repaired}
              reviewed={payload.validation.reviewed}
            />
          )}

          {/* Message Feedback - Approve/Edit/Regenerate buttons for assistant messages */}
          {!isUser && clientId && (messageId || payload?.messageId) && (
            <MessageFeedback
              messageId={messageId || payload?.messageId || ""}
              clientId={clientId}
              content={content}
              formatType={payload?.format_type}
              onRegenerate={onRegenerate}
              onSaveToLibrary={onSaveToLibrary}
              onUseContent={onUseContent}
              hasPlanningAccess={hasPlanningAccess}
            />
          )}
        </div>

        {/* Avatar do usuário */}
        {isUser && (
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-muted/80 border border-border/50 flex items-center justify-center mt-0.5 shadow-sm">
            <User className="h-4 w-4 text-muted-foreground" />
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
});

EnhancedMessageBubble.displayName = 'EnhancedMessageBubble';
