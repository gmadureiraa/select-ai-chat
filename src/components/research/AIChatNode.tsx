import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Send, Bot, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResearchChat } from "@/hooks/useResearchChat";
import { ResearchItem } from "@/hooks/useResearchItems";

interface AIChatNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  projectId: string;
}

export const AIChatNode = memo(({ data }: NodeProps<AIChatNodeData>) => {
  const { item, onDelete, projectId } = data;
  const [input, setInput] = useState("");
  const { messages, isStreaming, sendMessage } = useResearchChat(projectId, "google/gemini-2.5-flash");
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
  };

  return (
    <div className="bg-white border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl transition-shadow min-w-[400px] max-w-[400px] h-[500px] flex flex-col group relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-gray-400" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-gray-400" />
      <Handle type="target" position={Position.Right} className="w-3 h-3 !bg-gray-400" />

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-red-50 hover:text-red-600 z-10"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="flex items-center gap-2 p-3 border-b border-gray-200">
        <div className="p-2 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <Sparkles className="h-4 w-4 text-purple-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900">
            {item.title || "Chat com IA"}
          </h3>
          <p className="text-xs text-gray-500">Pergunte sobre os materiais conectados</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-xs">Conecte materiais e pergunte</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === "assistant" ? "" : "flex-row-reverse"}`}
            >
              <div
                className={`p-1.5 rounded-full shrink-0 ${
                  message.role === "assistant" ? "bg-purple-100" : "bg-gray-200"
                }`}
              >
                {message.role === "assistant" ? (
                  <Bot className="h-3 w-3 text-purple-600" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-gray-500" />
                )}
              </div>
              <div
                className={`flex-1 p-2 rounded-lg text-xs ${
                  message.role === "assistant" 
                    ? "bg-purple-50 border border-purple-100 text-gray-800" 
                    : "bg-gray-100 border border-gray-200 text-gray-700"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex gap-2">
              <div className="p-1.5 rounded-full bg-purple-100 shrink-0">
                <Bot className="h-3 w-3 text-purple-600 animate-pulse" />
              </div>
              <div className="flex-1 p-2 rounded-lg bg-purple-50 border border-purple-100">
                <p className="text-xs text-gray-500">Analisando materiais...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta..."
            className="min-h-[60px] max-h-[60px] resize-none text-xs bg-white"
            disabled={isStreaming}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isStreaming} 
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

AIChatNode.displayName = "AIChatNode";
