import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { KaiSidebar } from "@/components/kai/KaiSidebar";
import { MobileHeader } from "@/components/kai/MobileHeader";
import { GradientHero } from "@/components/kai/GradientHero";
import { KaiPerformanceTab } from "@/components/kai/KaiPerformanceTab";
import { KaiLibraryTab } from "@/components/kai/KaiLibraryTab";
import { KaiDocsTab } from "@/components/kai/KaiDocsTab";
import { KaiAssistantTab } from "@/components/kai/KaiAssistantTab";

import { ClientsManagementTool } from "@/components/kai/tools/ClientsManagementTool";
import { ContentCanvas } from "@/components/kai/canvas/ContentCanvas";
import { PlanningBoard } from "@/components/planning/PlanningBoard";
import { SettingsTab } from "@/components/settings/SettingsTab";

import { OnboardingFlow } from "@/components/onboarding";
import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
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
  const { isEnterprise, canAccessLibrary, canAccessPerformance, canAccessProfiles, isCanvas, canAccessKaiChat } = usePlanFeatures();
  const { showUpgradePrompt } = useUpgradePrompt();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingContentType, setPendingContentType] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Route protection: redirect to allowed tabs if trying to access unauthorized ones
  useEffect(() => {
    let shouldRedirect = false;
    let redirectTab = "canvas"; // Default for Canvas plan users
    
    // Removed tabs - redirect if accessing them
    const removedTabs = ["agent-builder", "research-lab", "knowledge-base", "team", "account", "templates", "format-rules", "repurpose"];
    if (removedTabs.includes(tab)) {
      shouldRedirect = true;
      redirectTab = "canvas"; // Redirect to canvas instead
    }
    
    // Viewer-blocked tabs
    if (isViewer) {
      const blockedTabs = ["home", "repurpose"];
      if (blockedTabs.includes(tab)) {
        shouldRedirect = true;
        redirectTab = "canvas";
      }
    }
    
    // Home requires canViewHome
    if (tab === "home" && !canViewHome) {
      shouldRedirect = true;
      redirectTab = "canvas";
    }
    
    // Repurpose requires canViewRepurpose
    if (tab === "repurpose" && !canViewRepurpose) {
      shouldRedirect = true;
      redirectTab = "canvas";
    }
    
    // Plan-based access restrictions for Canvas plan
    if (isCanvas) {
      // Library requires Pro plan
      if (tab === "library" && !canAccessLibrary) {
        shouldRedirect = true;
        redirectTab = "canvas";
        showUpgradePrompt("library_locked");
      }
      
      // Performance requires Pro plan
      if (tab === "performance" && !canAccessPerformance) {
        shouldRedirect = true;
        redirectTab = "canvas";
        showUpgradePrompt("performance_locked");
      }
      
      // Profiles require Pro plan
      if (tab === "clients" && !canAccessProfiles) {
        shouldRedirect = true;
        redirectTab = "canvas";
        showUpgradePrompt("profiles_locked");
      }
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
  }, [tab, canViewClients, canManageTeam, canViewHome, canViewRepurpose, isViewer, isCanvas, canAccessLibrary, canAccessPerformance, canAccessProfiles, searchParams, setSearchParams, showUpgradePrompt]);


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
    const toolTabs = ["canvas", "clients", "docs", "settings"];
    
    if (toolTabs.includes(tab)) {
      switch (tab) {
        case "canvas":
          return (
            <div className="h-full overflow-hidden">
              <ContentCanvas clientId={clientId || ""} />
            </div>
          );
        case "clients":
          return <ClientsManagementTool />;
        case "docs":
          return (
            <div className="p-6 overflow-y-auto h-full">
              <KaiDocsTab />
            </div>
          );
        case "settings":
          return <SettingsTab />;
        case "assistant":
          if (!selectedClient) {
            return (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p>Selecione um cliente para usar o chat</p>
                </div>
              </div>
            );
          }
          return (
            <div className="h-full overflow-hidden">
              <KaiAssistantTab clientId={selectedClient.id} client={selectedClient} />
            </div>
          );
      }
    }

    // Planning tab - available for all users, publishing is Enterprise only
    if (tab === "planning") {
      return (
        <div className={cn("h-full overflow-hidden", isMobile ? "p-2" : "p-6")}>
          <PlanningBoard 
            clientId={selectedClient?.id} 
            isEnterprise={isEnterprise}
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
      case "home":
        return (
          <GradientHero 
            onSubmit={handleSendMessage}
            onQuickAction={handleQuickAction}
            clientName={selectedClient.name}
            clientId={selectedClient.id}
          />
        );
      
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
        "flex-1 overflow-hidden",
        isMobile && "pt-14" // Space for mobile header
      )}>
        {renderContent()}
      </main>
    </div>
  );
}