import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { KaiSidebar } from "@/components/kai/KaiSidebar";
import { MobileHeader } from "@/components/kai/MobileHeader";
import { GradientHero } from "@/components/kai/GradientHero";
import { KaiPerformanceTab } from "@/components/kai/KaiPerformanceTab";

import { TeamTool } from "@/components/kai/tools/TeamTool";
import { ClientsManagementTool } from "@/components/kai/tools/ClientsManagementTool";
import { ContentRepurposeTool } from "@/components/kai/tools/ContentRepurposeTool";
import { ContentCanvas } from "@/components/kai/canvas/ContentCanvas";
import { PlanningBoard } from "@/components/planning/PlanningBoard";
import { FormatRulesTool } from "@/components/tools/FormatRulesTool";
import { AccountSettingsSection } from "@/components/settings/AccountSettingsSection";
import { OnboardingFlow } from "@/components/onboarding";
import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { UpgradePromptProvider } from "@/hooks/useUpgradePrompt";
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
  const { isEnterprise } = usePlanFeatures();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingContentType, setPendingContentType] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Route protection: redirect to allowed tabs if trying to access unauthorized ones
  useEffect(() => {
    let shouldRedirect = false;
    let redirectTab = "performance"; // Default for viewers
    
    // Removed tabs - redirect if accessing them
    const removedTabs = ["agent-builder", "research-lab", "assistant", "library", "knowledge-base"];
    if (removedTabs.includes(tab)) {
      shouldRedirect = true;
    }
    
    // Viewer-blocked tabs
    if (isViewer) {
      const blockedTabs = ["home", "repurpose"];
      if (blockedTabs.includes(tab)) {
        shouldRedirect = true;
        redirectTab = "performance";
      }
    }
    
    // Home requires canViewHome
    if (tab === "home" && !canViewHome) {
      shouldRedirect = true;
      redirectTab = "performance";
    }
    
    // Repurpose requires canViewRepurpose
    if (tab === "repurpose" && !canViewRepurpose) {
      shouldRedirect = true;
      redirectTab = "performance";
    }
    
    // Admin tabs require specific permissions
    if (tab === "clients" && !canViewClients) {
      shouldRedirect = true;
    }
    if (tab === "team" && !canManageTeam) {
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
    const toolTabs = ["repurpose", "canvas", "team", "clients", "account", "format-rules"];
    
    if (toolTabs.includes(tab)) {
      switch (tab) {
        case "repurpose":
          return (
            <div className="overflow-auto h-full p-0">
              <ContentRepurposeTool clientId={clientId || ""} />
            </div>
          );
        case "canvas":
          return (
            <div className="h-full overflow-hidden">
              <ContentCanvas clientId={clientId || ""} />
            </div>
          );
        case "team":
          return <TeamTool />;
        case "clients":
          return <ClientsManagementTool />;
        case "format-rules":
          return <FormatRulesTool />;
        case "account":
          return (
            <div className="p-6 overflow-y-auto h-full">
              <AccountSettingsSection />
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
          />
        );
      
      case "performance":
        return (
          <div className={cn("overflow-auto h-full", isMobile ? "p-3" : "p-6")}>
            <KaiPerformanceTab clientId={selectedClient.id} client={selectedClient} />
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
    <UpgradePromptProvider>
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
    </UpgradePromptProvider>
  );
}