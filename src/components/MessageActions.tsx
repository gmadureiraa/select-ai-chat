import { Copy, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageActionsProps {
  content: string;
  role: "user" | "assistant";
  onRegenerate?: () => void;
  isLastMessage?: boolean;
}

export const MessageActions = ({
  content,
  role,
  onRegenerate,
  isLastMessage,
}: MessageActionsProps) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard(2000);
  const { toast } = useToast();

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
      </TooltipProvider>
    </div>
  );
};
