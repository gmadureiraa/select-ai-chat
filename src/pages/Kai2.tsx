import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Kai2Sidebar } from "@/components/kai2/Kai2Sidebar";
import { GradientHero } from "@/components/kai2/GradientHero";
import { Kai2AssistantTab } from "@/components/kai2/Kai2AssistantTab";
import { KaiPerformanceTab } from "@/components/kai/KaiPerformanceTab";
import { KaiLibraryTab } from "@/components/kai/KaiLibraryTab";
import { KaiSettingsTab } from "@/components/kai/KaiSettingsTab";
import { KaiAutomationsTab } from "@/components/kai/KaiAutomationsTab";
import { AgentBuilderTool } from "@/components/kai2/tools/AgentBuilderTool";
import { ResearchLabTool } from "@/components/kai2/tools/ResearchLabTool";
import { KnowledgeBaseTool } from "@/components/kai2/tools/KnowledgeBaseTool";
import { ActivitiesTool } from "@/components/kai2/tools/ActivitiesTool";
import { TeamTool } from "@/components/kai2/tools/TeamTool";
import { ClientsManagementTool } from "@/components/kai2/tools/ClientsManagementTool";
import { useClients } from "@/hooks/useClients";
import { Loader2 } from "lucide-react";

export default function Kai2() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get("client");
  const tab = searchParams.get("tab") || "home";
  
  const { clients, isLoading: isLoadingClients } = useClients();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingContentType, setPendingContentType] = useState<string | null>(null);

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", newTab);
    setSearchParams(params);
  };

  const handleClientChange = (newClientId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("client", newClientId);
    setSearchParams(params);
  };

  // Auto-select first client if none selected
  useEffect(() => {
    if (!clientId && clients && clients.length > 0) {
      handleClientChange(clients[0].id);
    }
  }, [clientId, clients]);

  const handleSendMessage = (content: string, contentType?: string) => {
    setPendingMessage(content);
    setPendingContentType(contentType || null);
    handleTabChange("assistant");
  };

  const handleQuickAction = (action: string) => {
    handleTabChange(action);
  };

  const renderContent = () => {
    if (isLoadingClients) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Tools that don't need client
    const toolTabs = ["agent-builder", "research-lab", "knowledge-base", "activities", "team", "clients", "account"];
    
    if (toolTabs.includes(tab)) {
      switch (tab) {
        case "agent-builder":
          return <AgentBuilderTool />;
        case "research-lab":
          return <ResearchLabTool />;
        case "knowledge-base":
          return <KnowledgeBaseTool />;
        case "activities":
          return <ActivitiesTool />;
        case "team":
          return <TeamTool />;
        case "clients":
          return <ClientsManagementTool />;
        case "account":
          return (
            <div className="p-6">
              <h1 className="text-2xl font-semibold mb-4">Configurações da Conta</h1>
              <p className="text-muted-foreground">Em breve...</p>
            </div>
          );
      }
    }

    // Client-dependent tabs
    if (!selectedClient) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <p>Selecione um cliente para começar</p>
          </div>
        </div>
      );
    }

    switch (tab) {
      case "home":
        return (
          <GradientHero 
            onSubmit={handleSendMessage}
            onQuickAction={handleQuickAction}
            clientName={selectedClient.name}
          />
        );
      
      case "assistant":
        return (
          <Kai2AssistantTab
            clientId={selectedClient.id}
            client={selectedClient}
            initialMessage={pendingMessage || undefined}
            initialContentType={pendingContentType || undefined}
            onInitialMessageSent={() => {
              setPendingMessage(null);
              setPendingContentType(null);
            }}
          />
        );
      
      case "performance":
        return (
          <div className="p-6 overflow-auto h-full">
            <KaiPerformanceTab clientId={selectedClient.id} client={selectedClient} />
          </div>
        );
      
      case "library":
        return (
          <div className="p-6 overflow-auto h-full">
            <KaiLibraryTab clientId={selectedClient.id} client={selectedClient} />
          </div>
        );
      
      case "settings":
        return (
          <div className="p-6 overflow-auto h-full">
            <KaiSettingsTab clientId={selectedClient.id} client={selectedClient} />
          </div>
        );
      
      case "automations":
        return (
          <div className="p-6 overflow-auto h-full">
            <KaiAutomationsTab clientId={selectedClient.id} client={selectedClient} />
          </div>
        );
      
      default:
        return (
          <GradientHero 
            onSubmit={handleSendMessage}
            onQuickAction={handleQuickAction}
            clientName={selectedClient.name}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Kai2Sidebar
        activeTab={tab}
        onTabChange={handleTabChange}
        selectedClientId={clientId}
        onClientChange={handleClientChange}
      />

      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}