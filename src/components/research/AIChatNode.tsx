import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Send, Bot, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useResearchChat } from "@/hooks/useResearchChat";
import { ResearchItem } from "@/hooks/useResearchItems";

interface AIChatNodeData {
  item: ResearchItem;
  onDelete: (id: string) => void;
  projectId: string;
  connectedItems: ResearchItem[];
}

export const AIChatNode = memo(({ data }: NodeProps<AIChatNodeData>) => {
  const { item, onDelete, projectId, connectedItems } = data;
  const [input, setInput] = useState("");
  // Usar itemId para conversa isolada por card
  const { messages, isStreaming, sendMessage } = useResearchChat(projectId, item.id, "google/gemini-2.5-flash");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Removido atalho de teclado Delete/Backspace para evitar deleção acidental do card


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
    // Impede que Delete/Backspace propaguem para o elemento pai
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
  };

  return (
    <div 
      id={`ai-chat-${item.id}`}
      tabIndex={0}
      className="bg-white border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl transition-shadow min-w-[400px] max-w-[400px] h-[500px] flex flex-col group relative focus:outline-none focus:ring-2 focus:ring-purple-400"
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-gray-400" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-gray-400" />
      <Handle type="target" position={Position.Right} className="w-3 h-3 !bg-gray-400" />

      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 h-8 px-2 rounded-full border-red-200 text-red-600 bg-red-50/80 hover:bg-red-100 hover:text-red-700 z-10 flex items-center gap-1"
        onClick={() => onDelete(item.id)}
        title="Excluir card (Delete/Backspace)"
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
          <div className="flex items-center gap-1 mt-1">
            <p className="text-xs text-gray-500">
              {connectedItems.length > 0 
                ? `${connectedItems.length} ${connectedItems.length === 1 ? 'material conectado' : 'materiais conectados'}` 
                : 'Conecte materiais para análise'}
            </p>
            {connectedItems.length > 0 && (
              <div className="flex gap-1 ml-2">
                {connectedItems.slice(0, 3).map((item) => (
                  <div 
                    key={item.id} 
                    className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                    title={item.title || item.type}
                  >
                    {item.title?.substring(0, 10) || item.type}
                  </div>
                ))}
                {connectedItems.length > 3 && (
                  <div className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                    +{connectedItems.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div 
        className="flex-1 p-3 overflow-y-auto no-pan no-wheel" 
        ref={scrollRef}
        onWheel={(e) => e.stopPropagation()}
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
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
                    ? "bg-purple-50 border border-purple-100" 
                    : "bg-gray-100 border border-gray-200"
                }`}
              >
                <p className={`whitespace-pre-wrap leading-relaxed ${
                  message.role === "assistant" ? "text-gray-900" : "text-gray-900"
                }`}>
                  {message.content}
                </p>
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
      </div>

      <div className="p-2 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta..."
            className="min-h-[60px] max-h-[60px] resize-none text-xs bg-white text-gray-900 placeholder:text-gray-500"
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
