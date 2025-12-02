import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Send, Bot, Sparkles, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useResearchChat } from "@/hooks/useResearchChat";
import { ResearchItem } from "@/hooks/useResearchItems";
import { cn } from "@/lib/utils";

interface AIChatNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  projectId: string;
  clientId?: string;
  connectedItems: ResearchItem[];
  isConnected?: boolean;
}

export const AIChatNode = memo(({ data }: NodeProps<AIChatNodeData>) => {
  const { item, onDelete, projectId, clientId, connectedItems, isConnected } = data;
  const [input, setInput] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState<string[]>([]);
  const { messages, isStreaming, sendMessage } = useResearchChat(projectId, item.id, "google/gemini-2.5-flash", clientId, setAnalysisProgress);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const message = input;
    setInput("");
    await sendMessage.mutateAsync(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
  };

  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-all",
        "min-w-[400px] max-w-[400px] h-[500px] flex flex-col group relative",
        "focus:outline-none focus:ring-2 focus:ring-primary/20",
        isConnected && "ring-2 ring-primary/30",
        isStreaming && "ring-2 ring-primary/50"
      )}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-muted-foreground hover:!bg-foreground !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-muted-foreground hover:!bg-foreground !border-2 !border-background" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-muted-foreground hover:!bg-foreground !border-2 !border-background" id="left" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-muted-foreground hover:!bg-foreground !border-2 !border-background" id="right" />

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive z-10"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <div className="p-2 bg-muted rounded-lg">
          <Sparkles className="h-4 w-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground">
            {item.title || "Chat com IA"}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {connectedItems.length > 0 ? (
              <Badge variant="secondary" className="text-xs gap-1">
                <Link2 className="h-3 w-3" />
                {connectedItems.length} conectado{connectedItems.length > 1 ? "s" : ""}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Conecte materiais para análise</span>
            )}
          </div>
        </div>
      </div>

      {/* Connected Items Preview */}
      {connectedItems.length > 0 && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex gap-1 flex-wrap">
            {connectedItems.slice(0, 4).map((connItem) => (
              <Badge 
                key={connItem.id} 
                variant="outline"
                className="text-xs"
              >
                {connItem.title?.substring(0, 15) || connItem.type}
                {connItem.title && connItem.title.length > 15 && "..."}
              </Badge>
            ))}
            {connectedItems.length > 4 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{connectedItems.length - 4}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        className="flex-1 p-3 overflow-y-auto no-pan no-wheel" 
        ref={scrollRef}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-xs">
                {connectedItems.length > 0 
                  ? "Faça perguntas sobre os materiais conectados" 
                  : "Conecte materiais e faça perguntas"}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === "assistant" ? "" : "flex-row-reverse"}`}
            >
              <div
                className={cn(
                  "p-1.5 rounded-full shrink-0",
                  message.role === "assistant" ? "bg-muted" : "bg-muted"
                )}
              >
                {message.role === "assistant" ? (
                  <Bot className="h-3 w-3 text-foreground" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-muted-foreground" />
                )}
              </div>
              <div
                className={cn(
                  "flex-1 p-2 rounded-lg text-xs",
                  message.role === "assistant" 
                    ? "bg-muted/50" 
                    : "bg-muted border border-border"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex gap-2">
              <div className="p-1.5 rounded-full bg-muted shrink-0">
                <Bot className="h-3 w-3 text-foreground animate-pulse" />
              </div>
              <div className="flex-1 p-2 rounded-lg bg-muted/50">
                {analysisProgress.length > 0 ? (
                  <div className="space-y-1">
                    {analysisProgress.map((step, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">✓ {step}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Analisando materiais...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-end gap-2 bg-muted/30 rounded-xl border border-border p-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta..."
            className="min-h-[40px] max-h-[80px] resize-none text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-1"
            disabled={isStreaming}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isStreaming} 
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

AIChatNode.displayName = "AIChatNode";
