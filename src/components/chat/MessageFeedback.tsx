import { useState } from "react";
import { Check, RotateCcw, BookmarkPlus, Loader2, CalendarPlus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getAlternativeFormats } from "@/lib/formatDetection";

interface MessageFeedbackProps {
  messageId: string;
  clientId: string;
  content: string;
  formatType?: string;
  onRegenerate?: (feedback?: string, newFormat?: string) => void;
  onSaveToLibrary?: (content: string) => void;
  /** Callback when user clicks "Use" - opens planning dialog with content */
  onUseContent?: (content: string) => void;
  /** Whether the user has access to planning features */
  hasPlanningAccess?: boolean;
  /** Show "Refazer como" dropdown with alternative formats */
  showRegenerateAs?: boolean;
  className?: string;
}

export function MessageFeedback({
  messageId,
  clientId,
  content,
  formatType,
  onRegenerate,
  onSaveToLibrary,
  onUseContent,
  hasPlanningAccess = false,
  showRegenerateAs = true,
  className,
}: MessageFeedbackProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const { toast } = useToast();

  const submitFeedback = async (
    feedbackType: "approved" | "regenerated" | "saved_to_library",
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      await supabase.from("content_feedback").insert({
        message_id: messageId,
        client_id: clientId,
        user_id: userData.user.id,
        format_type: formatType,
        feedback_type: feedbackType,
        original_content: content,
        metadata: { content_length: content.length },
      });
      setFeedbackGiven(feedbackType);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    await submitFeedback("approved");
    setIsSubmitting(false);

    if (hasPlanningAccess && onUseContent) {
      // Abre o planning dialog pré-preenchido — user edita lá se precisar.
      onUseContent(content);
    } else {
      navigator.clipboard.writeText(content);
      toast({ description: "Conteúdo copiado! ✓", duration: 2000 });
    }
  };

  const handleRegenerate = async (newFormat?: string) => {
    setIsSubmitting(true);
    await submitFeedback("regenerated");
    setIsSubmitting(false);
    onRegenerate?.(undefined, newFormat);
  };

  const alternativeFormats = getAlternativeFormats(formatType);

  const handleSaveToLibrary = async () => {
    setIsSubmitting(true);
    await submitFeedback("saved_to_library");
    setIsSubmitting(false);
    onSaveToLibrary?.(content);
    toast({ description: "Salvo na biblioteca! ✓", duration: 2000 });
  };

  if (feedbackGiven) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          className
        )}
      >
        <Check className="h-3.5 w-3.5 text-green-500" />
        <span>
          {feedbackGiven === "approved" && "Aprovado"}
          {feedbackGiven === "edited" && "Editado"}
          {feedbackGiven === "regenerated" && "Regenerando..."}
          {feedbackGiven === "saved_to_library" && "Salvo na biblioteca"}
        </span>
      </motion.div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 hover:bg-green-500/10 hover:text-green-600"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : hasPlanningAccess && onUseContent ? (
                  <CalendarPlus className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {hasPlanningAccess && onUseContent ? "Usar" : "Copiar"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {hasPlanningAccess && onUseContent 
                ? "Usar no planejamento" 
                : "Copiar para área de transferência"
              }
            </TooltipContent>
          </Tooltip>

          {/* Botão "Editar" inline removido — user edita direto no planning
              dialog quando clica em "Usar". Isso simplifica o fluxo e reflete
              a visão do agente operador: rascunho aprovado entra pronto no
              planning, onde o edit completo acontece. */}

          {onRegenerate && (
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs gap-1.5 rounded-r-none"
                    onClick={() => handleRegenerate()}
                    disabled={isSubmitting}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Refazer
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerar conteúdo</TooltipContent>
              </Tooltip>
              
              {showRegenerateAs && alternativeFormats.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-1.5 rounded-l-none border-l border-border/30"
                      disabled={isSubmitting}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {alternativeFormats.slice(0, 6).map((format) => (
                      <DropdownMenuItem
                        key={format.key}
                        onClick={() => handleRegenerate(format.key)}
                        className="text-xs"
                      >
                        Refazer como {format.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {onSaveToLibrary && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={handleSaveToLibrary}
                  disabled={isSubmitting}
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Salvar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Salvar na biblioteca</TooltipContent>
            </Tooltip>
          )}
      </div>
    </div>
  );
}
