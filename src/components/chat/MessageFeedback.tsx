import { useState } from "react";
import { Check, Edit3, RotateCcw, BookmarkPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MessageFeedbackProps {
  messageId: string;
  clientId: string;
  content: string;
  formatType?: string;
  onRegenerate?: (feedback?: string) => void;
  onSaveToLibrary?: (content: string) => void;
  className?: string;
}

export function MessageFeedback({
  messageId,
  clientId,
  content,
  formatType,
  onRegenerate,
  onSaveToLibrary,
  className,
}: MessageFeedbackProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const { toast } = useToast();

  const calculateEditDistance = (original: string, edited: string): number => {
    // Simple Levenshtein-like distance based on character changes
    const longerLength = Math.max(original.length, edited.length);
    if (longerLength === 0) return 0;
    
    // Calculate similarity percentage (inverted to get distance)
    let matches = 0;
    const minLength = Math.min(original.length, edited.length);
    for (let i = 0; i < minLength; i++) {
      if (original[i] === edited[i]) matches++;
    }
    
    return Math.round(100 - (matches / longerLength) * 100);
  };

  const submitFeedback = async (
    feedbackType: "approved" | "edited" | "regenerated" | "saved_to_library",
    editDistance?: number,
    editedContentValue?: string
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
        edit_distance: editDistance,
        original_content: content,
        edited_content: editedContentValue,
        metadata: {
          content_length: content.length,
          edited_length: editedContentValue?.length,
        },
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
    toast({
      description: "Conteúdo aprovado! ✓",
      duration: 2000,
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(content);
  };

  const handleSaveEdit = async () => {
    setIsSubmitting(true);
    const distance = calculateEditDistance(content, editedContent);
    await submitFeedback("edited", distance, editedContent);
    setIsSubmitting(false);
    setIsEditing(false);
    
    // Copy edited content to clipboard
    navigator.clipboard.writeText(editedContent);
    toast({
      description: "Conteúdo editado copiado! ✓",
      duration: 2000,
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(content);
  };

  const handleRegenerate = async () => {
    setIsSubmitting(true);
    await submitFeedback("regenerated");
    setIsSubmitting(false);
    onRegenerate?.();
  };

  const handleSaveToLibrary = async () => {
    setIsSubmitting(true);
    await submitFeedback("saved_to_library");
    setIsSubmitting(false);
    onSaveToLibrary?.(editedContent || content);
    toast({
      description: "Salvo na biblioteca! ✓",
      duration: 2000,
    });
  };

  // If already gave feedback, show confirmation
  if (feedbackGiven && !isEditing) {
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
      {/* Editing mode */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[150px] text-sm font-mono"
              placeholder="Edite o conteúdo..."
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSubmitting || editedContent === content}
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                Salvar edição
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
              >
                Cancelar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {!isEditing && (
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
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Usar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Marcar como aprovado</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5"
                onClick={handleEdit}
                disabled={isSubmitting}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar antes de usar</TooltipContent>
          </Tooltip>

          {onRegenerate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs gap-1.5"
                  onClick={handleRegenerate}
                  disabled={isSubmitting}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Refazer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerar conteúdo</TooltipContent>
            </Tooltip>
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
      )}
    </div>
  );
}
