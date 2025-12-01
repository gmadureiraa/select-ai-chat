import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { ModelSelector } from "@/components/ModelSelector";
import { useResearchChat } from "@/hooks/useResearchChat";

interface ResearchChatPanelProps {
  projectId: string;
}

export const ResearchChatPanel = ({ projectId }: ResearchChatPanelProps) => {
  const [model, setModel] = useState("google/gemini-2.5-flash");
  const [input, setInput] = useState("");
  const { messages, isStreaming, sendMessage } = useResearchChat(projectId, model);
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
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Chat com IA</h3>
        <ModelSelector value={model} onChange={setModel} />
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Pergunte qualquer coisa sobre os materiais da pesquisa</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "assistant" ? "" : "flex-row-reverse"}`}
            >
              <div
                className={`p-2 rounded-full ${
                  message.role === "assistant" ? "bg-primary/10" : "bg-secondary"
                }`}
              >
                {message.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={`flex-1 p-3 rounded-lg ${
                  message.role === "assistant" ? "bg-card/50" : "bg-primary/10"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Bot className="h-4 w-4 animate-pulse" />
              </div>
              <div className="flex-1 p-3 rounded-lg bg-card/50">
                <p className="text-sm text-muted-foreground">Analisando...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Faça uma pergunta sobre a pesquisa..."
            className="min-h-[80px] resize-none"
            disabled={isStreaming}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
