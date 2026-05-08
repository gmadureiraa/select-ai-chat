import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
// Sidebar/header ficam eager — sempre visíveis, viram parte do "shell" do app.
import { KaiSidebar } from "@/components/kai/KaiSidebar";
import { MobileHeader } from "@/components/kai/MobileHeader";
import { MobileBottomNav } from "@/components/kai/MobileBottomNav";
import { OnboardingFlow } from "@/components/onboarding";
import { NotificationPermissionPrompt } from "@/components/notifications/NotificationPermissionPrompt";
import { PendingInvitesAlert } from "@/components/workspace/PendingInvitesAlert";
import { TabLoader } from "@/components/ui/page-loader";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

/**
 * Empty state padrão pra tabs que precisam de um cliente selecionado.
 * Mostra ícone, título e descrição contextual.
 */
function ClientRequiredEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <EmptyState
        icon={Users}
        title="Selecione um cliente"
        description={message}
        variant="default"
      />
    </div>
  );
}

// Tabs grandes: lazy. Cada um vira um chunk só baixado quando o user abre a tab.
// Generadores de conteúdo (sequence/reels/radar/hunter) são os mais pesados.
const HomeDashboard = lazy(() =>
  import("@/components/kai/home/HomeDashboard").then((m) => ({ default: m.HomeDashboard })),
);
const KaiPerformanceTab = lazy(() =>
  import("@/components/kai/KaiPerformanceTab").then((m) => ({ default: m.KaiPerformanceTab })),
);
const KaiLibraryTab = lazy(() =>
  import("@/components/kai/KaiLibraryTab").then((m) => ({ default: m.KaiLibraryTab })),
);
const KaiAssistantTab = lazy(() =>
  import("@/components/kai/KaiAssistantTab").then((m) => ({ default: m.KaiAssistantTab })),
);
const KaiAnalyticsTab = lazy(() =>
  import("@/components/kai/KaiAnalyticsTab").then((m) => ({ default: m.KaiAnalyticsTab })),
);
// ViralHunterTab (KAI-1.0 legacy) was removed em 2026-05-08 — substituido pelos
// 3 generadores Viral (sequence/reels/radar) que são as ports das versões atuais
// dos repos standalone (sequencia-viral, reels-viral, radar-viral). Backup em
// _legacy/viral-replaced-2026-05-08/.
const ViralSequenceTab = lazy(() =>
  // 2026-05-08 — substituído pela cópia LITERAL do app standalone
  // (`code/sequencia-viral/`), preservando UI/CSS/cores/fontes/layouts
  // ~95%+. A versão antiga (estilo KAI/Tailwind) ficou em
  // ViralSequenceTab.legacy.tsx pra referência histórica.
  import("@/components/kai/viral-sv-original/MainApp").then((m) => ({
    default: m.ViralSequenceTab,
  })),
);
const ViralReelsTab = lazy(() =>
  // 2026-05-08 — substituído pela cópia LITERAL do app standalone
  // (`code/reels-viral/`), preservando UI/CSS/cores/fontes/layouts ~95%+.
  // A versão antiga (estilo KAI/Tailwind) ficou em
  // ViralReelsTab.legacy.tsx pra referência histórica.
  import("@/components/kai/viral-reels-original/MainApp").then((m) => ({
    default: m.default,
  })),
);
const ViralRadarTab = lazy(() =>
  // 2026-05-08 — substituído pela cópia LITERAL do app standalone
  // (`code/radar-viral/`), preservando UI/CSS/cores/fontes/layouts
  // ~95%+. A versão antiga (estilo KAI/Tailwind) ficou em
  // ViralRadarTab.legacy.tsx pra referência histórica.
  import("@/components/kai/viral-radar-original/MainApp").then((m) => ({
    default: m.ViralRadarTab,
  })),
);
const ViralLibraryTab = lazy(() =>
  import("@/components/kai/ViralLibraryTab").then((m) => ({ default: m.ViralLibraryTab })),
);
const ViralFeatureGate = lazy(() =>
  import("@/components/kai/viral/ViralFeatureGate").then((m) => ({ default: m.ViralFeatureGate })),
);
// Placeholders foram substituídos pelas tabs reais (ViralSequenceTab, ViralReelsTab,
// ViralRadarTab) — os arquivos *.deprecated.tsx ficam no repo só como referência
// histórica e não são mais importados em lugar nenhum.
const MCPDocsTab = lazy(() =>
  import("@/components/kai/MCPDocsTab").then((m) => ({ default: m.MCPDocsTab })),
);
const ClientsManagementTool = lazy(() =>
  import("@/components/kai/tools/ClientsManagementTool").then((m) => ({
    default: m.ClientsManagementTool,
  })),
);
const PlanningBoard = lazy(() =>
  import("@/components/planning/PlanningBoard").then((m) => ({ default: m.PlanningBoard })),
);
const TeamTasksBoard = lazy(() =>
  import("@/components/tasks").then((m) => ({ default: m.TeamTasksBoard })),
);
const SettingsTab = lazy(() =>
  import("@/components/settings/SettingsTab").then((m) => ({ default: m.SettingsTab })),
);
const AutomationsTab = lazy(() =>
  import("@/components/automations/AutomationsTab").then((m) => ({ default: m.AutomationsTab })),
);
const RadarSourcesManager = lazy(() =>
  import("@/components/admin/RadarSourcesManager").then((m) => ({
    default: m.RadarSourcesManager,
  })),
);
const WorkspaceSettingsTab = lazy(() =>
  import("@/components/workspace/WorkspaceSettingsTab").then((m) => ({
    default: m.WorkspaceSettingsTab,
  })),
);
const WorkspaceMembersTab = lazy(() =>
  import("@/components/workspace/WorkspaceMembersTab").then((m) => ({
    default: m.WorkspaceMembersTab,
  })),
);
const BillingTab = lazy(() =>
  import("@/components/billing/BillingTab").then((m) => ({
    default: m.BillingTab,
  })),
);

export default function Kai() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get("client");
  const tab = searchParams.get("tab") || "home";
  const isMobile = useIsMobile();
  
  const { clients, isLoading: isLoadingClients } = useClients();
  const { canManageTeam, canViewPerformance, canViewClients, canViewHome, canViewRepurpose, isViewer, isOwner } = useWorkspace();
  const { isSuperAdmin } = useSuperAdmin();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Atalhos globais de teclado — funcionam em qualquer tab.
  // ⌘K / Ctrl+K → pula pro chat KAI (assistant)
  // ⌘J / Ctrl+J → pula pra Sequência Viral (carrossel)
  // ⌘I / Ctrl+I → pula pro Radar Viral (substitui antigo Viral Hunter)
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
        params.set("tab", "viral-carrossel");
        setSearchParams(params);
      } else if (key === "i" && !inEditable) {
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        params.set("tab", "viral-radar-page");
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

    // Legacy viral tab aliases — 2026-05-08 (replace-viral). Os tabs "sequence",
    // "reels", "radar" e "viral" (Hunter) foram unificados sob nomes únicos do
    // grupo "Viral". Redirect inline pra preservar bookmarks/links antigos.
    const legacyViralAlias: Record<string, string> = {
      sequence: "viral-carrossel",
      reels: "viral-reels-page",
      radar: "viral-radar-page",
      viral: "viral-radar-page", // Hunter (KAI-1.0) → Radar (substituto natural)
    };
    if (tab in legacyViralAlias) {
      shouldRedirect = true;
      redirectTab = legacyViralAlias[tab];
    }

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

    // Radar Sources Manager — só super_admin
    if (tab === "radar-sources-admin" && !isSuperAdmin) {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    // Workspace Settings — só owner
    if (tab === "workspace-settings" && !isOwner) {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    // Billing — só owner
    if (tab === "billing" && !isOwner) {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    // Workspace Members — owner ou admin
    if (tab === "workspace-members" && !canManageTeam) {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    if (shouldRedirect) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", redirectTab);
      setSearchParams(params);
    }
  }, [tab, canViewClients, canManageTeam, canViewHome, canViewRepurpose, isViewer, isOwner, isSuperAdmin, searchParams, setSearchParams]);


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
    // Tabs viral consolidadas no grupo único "Viral":
    //   viral-carrossel = Sequência Viral (gerador de carrossel)
    //   viral-reels-page = Reels Viral (engenharia reversa de reel)
    //   viral-radar-page = Radar Viral (briefing diário)
    //   viral-library = Biblioteca Viral (carrosséis + reels + briefings salvos)
    // Removidos em 2026-05-08 (replace-viral): "viral" (Hunter v1 KAI-1.0),
    // "sequence"/"reels"/"radar" (duplicatas do grupo Cliente que apontavam
    // pros mesmos componentes que viral-*).
    const toolTabs = [
      "clients", "settings", "automations", "assistant", "analytics", "home",
      "mcp",
      // Grupo "Viral" único (globais, não precisam de cliente):
      "viral-library", "viral-carrossel", "viral-reels-page", "viral-radar-page",
      // Admin (super_admin only):
      "radar-sources-admin",
      // Workspace management (owner / admin):
      "workspace-settings", "workspace-members", "billing",
    ];

    if (toolTabs.includes(tab)) {
      switch (tab) {
        case "viral-library":
          return <ViralLibraryTab />;
        case "viral-carrossel":
          return selectedClient ? (
            <ViralFeatureGate feature="sequencia">
              <div className="h-full overflow-hidden">
                <ViralSequenceTab
                  key={selectedClient.id}
                  clientId={selectedClient.id}
                  client={selectedClient}
                />
              </div>
            </ViralFeatureGate>
          ) : (
            <ClientRequiredEmpty message="Escolha um cliente na sidebar para gerar carrosséis com voz e estilo dele." />
          );
        case "viral-reels-page":
          return selectedClient ? (
            <ViralFeatureGate feature="reels">
              <div className="h-full overflow-hidden">
                <ViralReelsTab
                  key={selectedClient.id}
                  clientId={selectedClient.id}
                  client={selectedClient}
                />
              </div>
            </ViralFeatureGate>
          ) : (
            <ClientRequiredEmpty message="Escolha um cliente para gerar roteiros de Reels personalizados pro nicho dele." />
          );
        case "viral-radar-page":
          return selectedClient ? (
            <ViralFeatureGate feature="radar">
              <div className="h-full overflow-hidden">
                <ViralRadarTab
                  key={selectedClient.id}
                  clientId={selectedClient.id}
                  client={selectedClient}
                />
              </div>
            </ViralFeatureGate>
          ) : (
            <ClientRequiredEmpty message="Escolha um cliente para ver o radar de tendências e oportunidades virais." />
          );
        case "mcp":
          return <MCPDocsTab />;
        case "radar-sources-admin":
          return isSuperAdmin ? (
            <RadarSourcesManager />
          ) : (
            <ClientRequiredEmpty message="Acesso restrito a super admins." />
          );
        case "workspace-settings":
          return isOwner ? (
            <WorkspaceSettingsTab />
          ) : (
            <ClientRequiredEmpty message="Apenas o proprietário do workspace pode acessar essas configurações." />
          );
        case "workspace-members":
          return canManageTeam ? (
            <WorkspaceMembersTab />
          ) : (
            <ClientRequiredEmpty message="Apenas owners e admins podem gerenciar membros." />
          );
        case "billing":
          return isOwner ? (
            <BillingTab />
          ) : (
            <ClientRequiredEmpty message="Apenas o proprietário do workspace pode gerenciar a assinatura." />
          );
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
            <ClientRequiredEmpty message="Escolha um cliente pra ver métricas e analytics consolidadas." />
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
            <ClientRequiredEmpty message="Escolha um cliente pra abrir o chat com a kAI usando contexto dele." />
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

    // Tasks tab - tarefas internas do time (não exigem cliente)
    if (tab === "tasks") {
      return (
        <div className={cn("h-full min-h-0 overflow-hidden flex flex-col", isMobile ? "p-2" : "p-6")}>
          <TeamTasksBoard defaultClientId={selectedClient?.id} />
        </div>
      );
    }

    // Client-dependent tabs
    if (!selectedClient) {
      return (
        <ClientRequiredEmpty message="Escolha um cliente na sidebar para começar a planejar e gerar conteúdo." />
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

      <main
        id="main-content"
        className={cn(
          "flex-1 min-h-0 overflow-hidden flex flex-col",
          isMobile && "pt-14 pb-16" // Space for mobile header (top) + bottom nav
        )}
      >
        {/* Banner global de convites pendentes — aparece quando o user tem
            convites de outros workspaces aguardando aceite. Some sozinho. */}
        <PendingInvitesAlert />

        {/* ErrorBoundary com key={tab} faz reset automático ao trocar de tab,
            evitando que um erro num tab persista visível ao navegar pra outro.
            compact={true} renderiza fallback que não consome a app inteira. */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ErrorBoundary key={tab} compact context={`Tab: ${tab}`}>
            <Suspense fallback={<TabLoader />}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav — só aparece em mobile (md:hidden interno).
          Vive fora do <main> pra ficar fixo na viewport e não competir com
          overflow-hidden do conteúdo. */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
}