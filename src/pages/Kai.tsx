import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { KaiSidebar } from "@/components/kai/KaiSidebar";
import { GradientHero } from "@/components/kai/GradientHero";
import { KaiAssistantTab } from "@/components/kai/KaiAssistantTab";
import { KaiPerformanceTab } from "@/components/kai/KaiPerformanceTab";
import { KaiLibraryTab } from "@/components/kai/KaiLibraryTab";
import { KnowledgeBaseTool } from "@/components/kai/tools/KnowledgeBaseTool";
import { ActivitiesTool } from "@/components/kai/tools/ActivitiesTool";
import { TeamTool } from "@/components/kai/tools/TeamTool";
import { ClientsManagementTool } from "@/components/kai/tools/ClientsManagementTool";
import { PlanningBoard } from "@/components/planning/PlanningBoard";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { cn } from "@/lib/utils";

import { Loader2 } from "lucide-react";

export default function Kai() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get("client");
  const tab = searchParams.get("tab") || "home";
  
  const { clients, isLoading: isLoadingClients } = useClients();
  const { canManageTeam, canViewTools, canViewPerformance, canViewLibrary, canViewKnowledgeBase, canViewActivities, canViewClients } = useWorkspace();
  const { isEnterprise } = usePlanFeatures();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingContentType, setPendingContentType] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Route protection: redirect to home if trying to access unauthorized tabs
  useEffect(() => {
    let shouldRedirect = false;
    
    // Removed dev-only tools - redirect if accessing removed tabs
    if (tab === "automations" || tab === "agent-builder" || tab === "research-lab") {
      shouldRedirect = true;
    }
    
    // Knowledge base requires canViewKnowledgeBase (member+)
    if (tab === "knowledge-base" && !canViewKnowledgeBase) {
      shouldRedirect = true;
    }
    
    // Library requires canViewLibrary (member+)
    if (tab === "library" && !canViewLibrary) {
      shouldRedirect = true;
    }
    
    // Admin tabs require specific permissions
    if (tab === "activities" && !canViewActivities) {
      shouldRedirect = true;
    }
    if (tab === "clients" && !canViewClients) {
      shouldRedirect = true;
    }
    if (tab === "team" && !canManageTeam) {
      shouldRedirect = true;
    }
    
    if (shouldRedirect) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", "home");
      setSearchParams(params);
    }
  }, [tab, canViewKnowledgeBase, canViewLibrary, canViewActivities, canViewClients, canManageTeam, searchParams, setSearchParams]);


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
    const toolTabs = ["knowledge-base", "activities", "team", "clients", "account"];
    
    if (toolTabs.includes(tab)) {
      switch (tab) {
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

    // Planning tab - uses unified PlanningBoard
    if (tab === "planning" && isEnterprise) {
      return (
        <div className="p-6 h-full overflow-hidden">
          <PlanningBoard clientId={selectedClient?.id} />
        </div>
      );
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
          <KaiAssistantTab
            clientId={selectedClient.id}
            client={selectedClient}
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
    <div className="flex h-screen bg-background w-full">
      <KaiSidebar
        activeTab={tab}
        onTabChange={handleTabChange}
        selectedClientId={clientId}
        onClientChange={handleClientChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
