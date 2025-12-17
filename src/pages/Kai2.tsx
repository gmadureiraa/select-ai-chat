import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Kai2Sidebar } from "@/components/kai2/Kai2Sidebar";
import { GradientHero } from "@/components/kai2/GradientHero";
import { Kai2ChatArea } from "@/components/kai2/Kai2ChatArea";
import { useClients } from "@/hooks/useClients";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Kai2() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get("client");
  const tab = searchParams.get("tab") || "home";
  
  const { clients } = useClients();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", newTab);
    setSearchParams(params);
  };

  const handleClientChange = (newClientId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("client", newClientId);
    setSearchParams(params);
    // Reset messages when client changes
    setMessages([]);
  };

  // Auto-select first client if none selected
  useEffect(() => {
    if (!clientId && clients && clients.length > 0) {
      handleClientChange(clients[0].id);
    }
  }, [clientId, clients]);

  const handleSendMessage = async (content: string, contentType?: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: contentType ? `[${contentType}] ${content}` : content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Vou criar conteúdo sobre "${content}" para ${selectedClient?.name || "você"}. Esta é uma resposta de demonstração da nova interface Kai2.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const showHero = messages.length === 0 && tab === "home";

  return (
    <div className="flex h-screen bg-background">
      <Kai2Sidebar
        activeTab={tab}
        onTabChange={handleTabChange}
        selectedClientId={clientId}
        onClientChange={handleClientChange}
      />

      <main className="flex-1 overflow-hidden">
        {showHero ? (
          <GradientHero 
            onSubmit={handleSendMessage}
            clientName={selectedClient?.name}
          />
        ) : tab === "home" || tab === "assistant" ? (
          <Kai2ChatArea
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-medium text-white/80 mb-2">
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </h2>
              <p className="text-white/40">
                Esta seção está em desenvolvimento
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
