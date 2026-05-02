import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { KaiSidebar } from "@/components/kai/KaiSidebar";
import { MobileHeader } from "@/components/kai/MobileHeader";
import { HomeDashboard } from "@/components/kai/home/HomeDashboard";
import { KaiPerformanceTab } from "@/components/kai/KaiPerformanceTab";
import { KaiLibraryTab } from "@/components/kai/KaiLibraryTab";
import { KaiAssistantTab } from "@/components/kai/KaiAssistantTab";
import { KaiAnalyticsTab } from "@/components/kai/KaiAnalyticsTab";
import { ViralHunterTab } from "@/components/kai/ViralHunterTab";
import { ViralSequenceTab } from "@/components/kai/ViralSequenceTab";
import { MCPDocsTab } from "@/components/kai/MCPDocsTab";
import { ClientsManagementTool } from "@/components/kai/tools/ClientsManagementTool";
import { PlanningBoard } from "@/components/planning/PlanningBoard";
import { SettingsTab } from "@/components/settings/SettingsTab";
import { AutomationsTab } from "@/components/automations/AutomationsTab";
import { OnboardingFlow } from "@/components/onboarding";
import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default function Kai() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get("client");
  const tab = searchParams.get("tab") || "home";
  const isMobile = useIsMobile();
  
  const { clients, isLoading: isLoadingClients } = useClients();
  const { canManageTeam, canViewPerformance, canViewClients, canViewHome, canViewRepurpose, isViewer } = useWorkspace();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Atalhos globais de teclado — funcionam em qualquer tab.
  // ⌘K / Ctrl+K → pula pro chat KAI (assistant)
  // ⌘J / Ctrl+J → pula pra Sequência Viral
  // ⌘I / Ctrl+I → pula pro Viral Hunter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      // Não bloqueia Cmd+K em inputs (é o padrão universal de "command menu")
      // mas ignora Cmd+J/I em inputs (podem conflitar com atalhos do browser)
      const key = e.key.toLowerCase();
      if (key === "k") {
        if (inEditable) return;
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        params.set("tab", "assistant");
        setSearchParams(params);
      } else if (key === "j" && !inEditable) {
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        params.set("tab", "sequence");
        setSearchParams(params);
      } else if (key === "i" && !inEditable) {
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        params.set("tab", "viral");
        setSearchParams(params);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchParams, setSearchParams]);

  // Route protection: redirect to allowed tabs if trying to access unauthorized ones
  useEffect(() => {
    let shouldRedirect = false;
    let redirectTab = "planning"; // Default redirect
    
    // Removed tabs - redirect if accessing them
    const removedTabs = ["agent-builder", "research-lab", "knowledge-base", "team", "account", "templates", "format-rules", "repurpose", "canvas"];
    if (removedTabs.includes(tab)) {
      shouldRedirect = true;
    }
    
    // Viewer-blocked tabs
    if (isViewer) {
      const blockedTabs = ["home", "repurpose"];
      if (blockedTabs.includes(tab)) {
        shouldRedirect = true;
        redirectTab = "planning";
      }
    }
    
    // Home requires canViewHome
    if (tab === "home" && !canViewHome) {
      shouldRedirect = true;
      redirectTab = "planning";
    }
    
    // Repurpose requires canViewRepurpose
    if (tab === "repurpose" && !canViewRepurpose) {
      shouldRedirect = true;
      redirectTab = "planning";
    }
    
    // Admin tabs require specific permissions
    if (tab === "clients" && !canViewClients) {
      shouldRedirect = true;
    }
    
    if (shouldRedirect) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", redirectTab);
      setSearchParams(params);
    }
  }, [tab, canViewClients, canManageTeam, canViewHome, canViewRepurpose, isViewer, searchParams, setSearchParams]);


  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", newTab);
    setSearchParams(params);
    // Close mobile menu when tab changes
    setMobileMenuOpen(false);
  };

  const handleClientChange = (newClientId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (newClientId) {
      params.set("client", newClientId);
    } else {
      params.delete("client");
    }
    setSearchParams(params);
  };

  // Auto-select first client if none selected
  useEffect(() => {
    if (!clientId && clients && clients.length > 0) {
      handleClientChange(clients[0].id);
    }
  }, [clientId, clients]);


  const renderContent = () => {
    if (isLoadingClients) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Tools that don't need client (ou que precisam mas tem fallback interno).
    // "viral" e "sequence" renderizam tabs customizadas no switch abaixo.
    const toolTabs = ["clients", "settings", "automations", "assistant", "analytics", "home", "viral", "sequence", "mcp"];
    
    if (toolTabs.includes(tab)) {
      switch (tab) {
        case "mcp":
          return <MCPDocsTab />;
        case "home":
          return (
            <HomeDashboard 
              onNavigate={handleTabChange}
              onOpenItem={(itemId) => {
                const params = new URLSearchParams(searchParams);
                params.set("tab", "planning");
                params.set("openItem", itemId);
                setSearchParams(params);
              }}
              selectedClientId={selectedClient?.id}
            />
          );
        case "clients":
          return <ClientsManagementTool />;
        case "settings":
          return <SettingsTab />;
        case "automations":
          return <AutomationsTab />;
        case "analytics":
          return selectedClient ? (
            <div className={cn("overflow-auto h-full", isMobile ? "p-3" : "p-6")}>
              <KaiAnalyticsTab clientId={selectedClient.id} client={selectedClient} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p>Selecione um cliente para ver analytics</p>
              </div>
            </div>
          );
        case "assistant":
          return selectedClient ? (
            <div className="h-full overflow-hidden">
              {/* key={selectedClient.id} força remount ao trocar de cliente,
                  garantindo zero state residual (mensagens, conversationId)
                  do cliente anterior. Cada cliente tem seu próprio chat. */}
              <KaiAssistantTab
                key={selectedClient.id}
                clientId={selectedClient.id}
                client={selectedClient}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p>Selecione um cliente para usar o chat</p>
              </div>
            </div>
          );
        case "viral":
          return selectedClient ? (
            <div className="h-full overflow-hidden">
              <ViralHunterTab
                key={selectedClient.id}
                clientId={selectedClient.id}
                client={selectedClient}
                onUseAsInspiration={(prompt) => {
                  // Leva o user pro chat com o prompt pré-preenchido via URL.
                  setSearchParams({
                    client: selectedClient.id,
                    tab: "assistant",
                    prompt,
                  });
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p>Selecione um cliente para ver posts virais</p>
              </div>
            </div>
          );
        case "sequence":
          return selectedClient ? (
            <div className="h-full overflow-hidden">
              <ViralSequenceTab
                key={selectedClient.id}
                clientId={selectedClient.id}
                client={selectedClient}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p>Selecione um cliente para criar carrossel</p>
              </div>
            </div>
          );
      }
    }

    // Planning tab - available for all users, publishing is Enterprise only
    if (tab === "planning") {
      return (
        <div className={cn("h-full min-h-0 overflow-hidden", isMobile ? "p-2" : "p-6")}>
          <PlanningBoard 
            clientId={selectedClient?.id} 
            isEnterprise={true}
            onClientChange={handleClientChange}
          />
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
      case "performance":
        return (
          <div className={cn("overflow-auto h-full", isMobile ? "p-3" : "p-6")}>
            <KaiPerformanceTab clientId={selectedClient.id} client={selectedClient} />
          </div>
        );
      
      case "library":
        return (
          <div className={cn("h-full flex flex-col", isMobile ? "p-3" : "p-6")}>
            <KaiLibraryTab clientId={selectedClient.id} client={selectedClient} />
          </div>
        );
      
      default:
        return (
          <HomeDashboard 
            onNavigate={handleTabChange}
            selectedClientId={selectedClient?.id}
            onOpenItem={(itemId) => {
              const params = new URLSearchParams(searchParams);
              params.set("tab", "planning");
              params.set("openItem", itemId);
              setSearchParams(params);
            }}
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-background w-full">
      {/* Onboarding Flow */}
      <OnboardingFlow />
      
      {/* Notification Permission Prompt */}
      <NotificationPermissionPrompt />
      
      {/* Desktop: Fixed Sidebar */}
      {!isMobile && (
        <KaiSidebar
          activeTab={tab}
          onTabChange={handleTabChange}
          selectedClientId={clientId}
          onClientChange={handleClientChange}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Mobile: Header + Sheet Sidebar */}
      {isMobile && (
        <>
          <MobileHeader 
            onMenuClick={() => setMobileMenuOpen(true)}
            clientName={selectedClient?.name}
          />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="p-0 w-72">
              <KaiSidebar
                activeTab={tab}
                onTabChange={handleTabChange}
                selectedClientId={clientId}
                onClientChange={handleClientChange}
                collapsed={false}
                onToggleCollapse={() => {}}
                isMobile={true}
              />
            </SheetContent>
          </Sheet>
        </>
      )}

      <main className={cn(
        "flex-1 min-h-0 overflow-hidden",
        isMobile && "pt-14" // Space for mobile header
      )}>
        {renderContent()}
      </main>
    </div>
  );
}