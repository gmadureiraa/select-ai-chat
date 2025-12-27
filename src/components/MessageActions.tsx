import { Copy, Check, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";

interface MessageActionsProps {
  content: string;
  role: "user" | "assistant";
  onRegenerate?: () => void;
  isLastMessage?: boolean;
  clientId?: string;
  clientName?: string;
  templateName?: string;
}

export const MessageActions = ({
  content,
  role,
  onRegenerate,
  isLastMessage,
  clientId,
  templateName,
}: MessageActionsProps) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard(2000);
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const { user } = useAuth();

  const handleCopy = async () => {
    const success = await copyToClipboard(content);
    if (success) {
      toast({
        description: "Mensagem copiada!",
        duration: 2000,
      });
    } else {
      toast({
        description: "Erro ao copiar mensagem",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleAddToPlanning = async () => {
    if (!workspace?.id || !user?.id) {
      toast({
        description: "Workspace não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      // Detect content type from template name or content
      let contentType = "social_post";
      let platform = null;
      
      if (templateName) {
        const templateLower = templateName.toLowerCase();
        if (templateLower.includes("newsletter")) {
          contentType = "newsletter";
          platform = "email";
        } else if (templateLower.includes("carrossel") || templateLower.includes("carousel")) {
          contentType = "carousel";
          platform = "instagram";
        } else if (templateLower.includes("reels") || templateLower.includes("shorts")) {
          contentType = "reels";
          platform = "instagram";
        } else if (templateLower.includes("thread")) {
          contentType = "thread";
          platform = "twitter";
        } else if (templateLower.includes("linkedin")) {
          contentType = "post";
          platform = "linkedin";
        } else if (templateLower.includes("tweet")) {
          contentType = "tweet";
          platform = "twitter";
        } else if (templateLower.includes("youtube") || templateLower.includes("vídeo")) {
          contentType = "video";
          platform = "youtube";
        }
      }

      // Extract title from content (first line or first 50 chars)
      const firstLine = content.split("\n")[0].replace(/^[#*\-\s]+/, "").trim();
      const title = firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine || "Conteúdo gerado por IA";

      const { error } = await supabase
        .from("planning_items")
        .insert({
          workspace_id: workspace.id,
          client_id: clientId || null,
          title,
          content,
          content_type: contentType,
          platform,
          status: "idea",
          priority: "medium",
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        description: "Adicionado ao planejamento!",
        duration: 2000,
      });
    } catch (error: any) {
      console.error("Error adding to planning:", error);
      toast({
        description: "Erro ao adicionar ao planejamento",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isCopied ? "Copiado!" : "Copiar mensagem"}</p>
          </TooltipContent>
        </Tooltip>

        {role === "assistant" && isLastMessage && onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onRegenerate}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Regenerar resposta</p>
            </TooltipContent>
          </Tooltip>
        )}

        {role === "assistant" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleAddToPlanning}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adicionar ao planejamento</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
};
