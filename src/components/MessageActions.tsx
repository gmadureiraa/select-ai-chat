import { Copy, Check, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/hooks/use-toast";
import { useFavoriteMessages } from "@/hooks/useFavoriteMessages";
import { MessageRating } from "@/components/chat/MessageRating";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageActionsProps {
  content: string;
  role: "user" | "assistant";
  onRegenerate?: () => void;
  isLastMessage?: boolean;
  clientId?: string;
  clientName?: string;
  templateName?: string;
  messageId?: string;
}

export const MessageActions = ({
  content,
  role,
  onRegenerate,
  isLastMessage,
  clientId,
  messageId,
}: MessageActionsProps) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard(2000);
  const { toast } = useToast();
  const { isFavorite, toggleFavorite, isToggling } = useFavoriteMessages(clientId || "");

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

  const handleFavorite = () => {
    if (!messageId || !clientId) return;
    toggleFavorite({ messageId });
  };

  const isMessageFavorite = messageId ? isFavorite(messageId) : false;

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Favorite button - only for assistant messages with messageId */}
      {role === "assistant" && messageId && clientId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleFavorite}
              disabled={isToggling}
            >
              <Star className={`h-3.5 w-3.5 ${isMessageFavorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isMessageFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}</p>
          </TooltipContent>
        </Tooltip>
      )}

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

      {/* Rating buttons for assistant messages */}
      {role === "assistant" && messageId && (
        <MessageRating messageId={messageId} />
      )}
    </div>
  );
};
