import { useState, useEffect, Suspense } from "react";
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
// Sidebar/header ficam eager — sempre visíveis, viram parte do "shell" do app.
import { KaiSidebar } from "@/components/kai/KaiSidebar";
import { MobileHeader } from "@/components/kai/MobileHeader";
import { MobileBottomNav } from "@/components/kai/MobileBottomNav";
import { PendingInvitesAlert } from "@/components/workspace/PendingInvitesAlert";
import { SkipLink } from "@/components/ui/skip-link";

// Onboarding e prompt de notificação só são visíveis em conditional flow
// (primeiro acesso e quando o user permitiria push). Lazy tira ~15-20kB
// do chunk principal do KAI sem afetar TTI.
const OnboardingFlow = lazyWithRetry(() =>
  import("@/components/onboarding").then((m) => ({ default: m.OnboardingFlow })),
);
const NotificationPermissionPrompt = lazyWithRetry(() =>
  import("@/components/notifications/NotificationPermissionPrompt").then((m) => ({
    default: m.NotificationPermissionPrompt,
  })),
);
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
const HomeDashboard = lazyWithRetry(() =>
  import("@/components/kai/home/HomeDashboard").then((m) => ({ default: m.HomeDashboard })),
);
// Performance refeito 2026-05-09: alimentado 100% por Metricool API.
// Antigo KaiPerformanceTab.tsx (CSV + Apify scrape) preservado em legacy
// caso precise rollback.
const KaiPerformanceTab = lazyWithRetry(() =>
  import("@/components/kai/performance-v2/MetricoolPerformance").then((m) => ({
    default: m.MetricoolPerformance,
  })),
);
const KaiLibraryTab = lazyWithRetry(() =>
  import("@/components/kai/KaiLibraryTab").then((m) => ({ default: m.KaiLibraryTab })),
);
const KaiAssistantTab = lazyWithRetry(() =>
  import("@/components/kai/KaiAssistantTab").then((m) => ({ default: m.KaiAssistantTab })),
);
// KaiAnalyticsTab REMOVIDO da rota em 2026-05-09 — Performance v4 (Metricool)
// cobre tudo que ele fazia. Sidebar nem expõe mais "Analytics". `?tab=analytics`
// redireciona pra `performance` no useEffect abaixo.
//
// ViralHunterTab (KAI-1.0 legacy) was removed em 2026-05-08 — substituido pelos
// 3 generadores Viral (sequence/reels/radar) que são as ports das versões atuais
// dos repos standalone (sequencia-viral, reels-viral, radar-viral). Backup em
// _legacy/viral-replaced-2026-05-08/.
// 2026-05-11 — Sequência Viral volta a montar nativamente dentro do KAI.
// O SVLauncher continua no repo como fallback/documentação, mas a rota principal
// precisa abrir o fluxo core dentro do shell: lista, criação, edição, preview e
// export.
const ViralSequenceTab = lazyWithRetry(() =>
  import("@/components/kai/viral-sv-original/MainApp").then((m) => ({
    default: m.default,
  })),
);
// 2026-05-16 — Reels Viral e Radar Viral removidos do KAI por completo.
// Eram cópias dos apps standalone (`code/reels-viral/`, `code/radar-viral/`)
// que pesavam o bundle e duplicavam superfície de bug. Continuam vivos como
// produtos separados em reels.kaleidos.com.br e radar.kaleidos.com.br.
// Aqui no KAI fica só Sequência Viral (carrossel), que é a feature core.
// ViralLibraryTab removida 2026-05-08 — unificada com KaiLibraryTab (per cliente).
// Refs/ideas/reels viáveis agora vivem em client_reference_library com format
// + scenes (Reels Viral pattern) + slides_text (carousel pattern).
const ViralFeatureGate = lazyWithRetry(() =>
  import("@/components/kai/viral/ViralFeatureGate").then((m) => ({ default: m.ViralFeatureGate })),
);
// Placeholders foram substituídos pelas tabs reais (ViralSequenceTab, ViralReelsTab,
// ViralRadarTab) — os arquivos *.deprecated.tsx ficam no repo só como referência
// histórica e não são mais importados em lugar nenhum.
//
// 2026-05-09 — MCPDocsTab removido como rota top-level (?tab=mcp). Continua
// importado eagerly dentro de SettingsTab (section "mcp"). Bookmark antigo
// `?tab=mcp` redireciona pra `?tab=settings&section=mcp` no useEffect acima.
//
// 2026-05-10 — ClientsManagementTool não é mais montado dentro do Kai.tsx.
// O tab=clients redireciona pra rota dedicada `/kaleidos/clients` (que renderiza
// ClientsListPage). Decisão: rota dedicada é mais bookmarkable, mais simples de
// linkar e elimina a duplicação ClientsManagementTool ↔ ClientsListPage. O
// componente ClientsManagementTool permanece no repo como referência (quem sabe
// volta pra um KAI tool slot futuro), mas não é importado nem montado em rota
// nenhuma do app principal.
const PlanningBoard = lazyWithRetry(() =>
  import("@/components/planning/PlanningBoard").then((m) => ({ default: m.PlanningBoard })),
);
const TeamTasksBoard = lazyWithRetry(() =>
  import("@/components/tasks").then((m) => ({ default: m.TeamTasksBoard })),
);
const SettingsTab = lazyWithRetry(() =>
  import("@/components/settings/SettingsTab").then((m) => ({ default: m.SettingsTab })),
);
const AutomationsTab = lazyWithRetry(() =>
  import("@/components/automations/AutomationsTab").then((m) => ({ default: m.AutomationsTab })),
);
// 2026-05-18 — restaurado: ClientsListPage agora monta INLINE como tab dentro do
// Kai shell pra não perder sidebar. Antes (2026-05-10) era rota dedicada
// `/kaleidos/clients` mas isso quebrava o layout (sem sidebar).
const ClientsListPage = lazyWithRetry(() =>
  import("@/components/clients/ClientsListPage").then((m) => ({ default: m.ClientsListPage })),
);
// 2026-05-09 — RadarSourcesManager, WorkspaceSettingsTab e WorkspaceMembersTab
// foram movidos pra dentro de SettingsTab (sections workspace, members,
// radar-sources). Imports lazy removidos daqui — agora vivem em
// src/components/settings/SettingsTab.tsx.
//
// MetricoolHashtagsTracker, MetricoolCompetitorsPanel e MetricoolReportsManager
// viraram sub-tabs per-client dentro do Perfil do Cliente (tab Viral). Ainda
// existem como componentes — só não montam mais em rota global do Kai.tsx.
//
// BillingTab REMOVIDO — KAI 2.0 é uso interno Kaleidos, sem cobrança por workspace.
// O arquivo src/components/billing/BillingTab.tsx ainda existe mas não é mais
// importado nem montado em rota nenhuma.
// MetricoolInboxPanel é 1197 linhas — lazy pra não inflar bundle inicial
const MetricoolInboxPanel = lazyWithRetry(() =>
  import("@/components/metricool/MetricoolInboxPanel").then((m) => ({ default: m.MetricoolInboxPanel })),
);
// 2026-05-09 — MetricoolCalendarView e MetricoolSmartLinksManager removidos:
//   * editorial-calendar foi removido do switch (Calendar live em PlanningBoard)
//   * smart-links foi removido do switch
// MetricoolLinkinBioEditor foi removido do menu (decisão usuário). Código permanece
// em src/components/metricool/MetricoolLinkinBioEditor.tsx caso seja reativado.

export default function Kai() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientId = searchParams.get("client");
  const carouselId = searchParams.get("carouselId");
  // 2026-05-18 — `/kaleidos/clients` aponta pra Kai shell com tab=clients
  // (preservando sidebar). Pathname override: bookmarks antigos continuam OK.
  const location = useLocation();
  const tabFromPath = location.pathname === "/kaleidos/clients" ? "clients" : null;
  const tab = tabFromPath || searchParams.get("tab") || "home";
  const isMobile = useIsMobile();
  
  const { clients, isLoading: isLoadingClients } = useClients();
  const { canManageTeam, canViewPerformance, canViewClients, canViewHome, canViewRepurpose, isViewer, isOwner, isLoadingWorkspace } = useWorkspace();
  const { isSuperAdmin } = useSuperAdmin();
  const selectedClient = clients?.find(c => c.id === clientId);
  
  // 2026-05-16 — fix audit P1-2: persiste estado collapsed em localStorage
  // pra sobreviver a reloads (login, refresh, deep link). Mesmo padrão usado
  // por `kai-theme` (next-themes em App.tsx).
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("kai_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "kai_sidebar_collapsed",
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      // localStorage indisponível (private mode em algum browser exótico) — ignora
    }
  }, [sidebarCollapsed]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Atalhos globais de teclado — funcionam em qualquer tab.
  // ⌘K / Ctrl+K → abre o CommandPalette global (handler em
  //   src/components/CommandPalette.tsx; mantemos APENAS aquele para evitar
  //   conflito que disparava 2 ações no mesmo keydown — 2026-05-16).
  // ⌘J / Ctrl+J → pula pra Sequência Viral (carrossel)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const key = e.key.toLowerCase();
      // Cmd+K é tratado exclusivamente pelo CommandPalette — não interceptar
      // aqui (causa double-fire: muda tab pra assistant E abre palette).
      if (key === "k") return;
      // Viewer: Cmd+J redireciona pra planning (única tab permitida)
      if (isViewer && key === "j") {
        if (inEditable) return;
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        params.set("tab", "planning");
        setSearchParams(params);
        return;
      }
      if (key === "j" && !inEditable) {
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        params.set("tab", "viral-carrossel");
        setSearchParams(params);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isViewer, searchParams, setSearchParams]);

  // Route protection: redirect to allowed tabs if trying to access unauthorized ones
  useEffect(() => {
    if (isLoadingWorkspace) return;

    // 2026-05-18 — `tab=clients` volta a renderizar INLINE no Kai shell
    // (case "clients" no switch abaixo). Tentativa de 2026-05-10 com rota
    // dedicada `/kaleidos/clients` quebrava o sidebar — usuário caía numa
    // página standalone sem nav. Permission gate continua valendo.
    if (tab === "clients" && !canViewClients) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", "planning");
      setSearchParams(params);
      return;
    }

    let shouldRedirect = false;
    let redirectTab = "planning"; // Default redirect

    // Legacy viral tab aliases — 2026-05-16. Reels e Radar foram REMOVIDOS do
    // KAI (continuam como apps separados em reels.kaleidos.com.br e
    // radar.kaleidos.com.br). Qualquer link antigo cai em viral-carrossel.
    const legacyViralAlias: Record<string, string> = {
      sequence: "viral-carrossel",
      reels: "viral-carrossel",
      "viral-reels-page": "viral-carrossel",
      radar: "viral-carrossel",
      "viral-radar-page": "viral-carrossel",
      viral: "viral-carrossel",
    };
    if (tab in legacyViralAlias) {
      shouldRedirect = true;
      redirectTab = legacyViralAlias[tab];
    }

    // Client approval portal: external viewers only access Planning. They can
    // comment and approve/reject review cards there, but do not see internal
    // tools, libraries, automations, performance, viral generators, or settings.
    if (isViewer && tab !== "planning") {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    // Removed tabs - redirect if accessing them
    // analytics adicionado em 2026-05-09 (Performance v4 cobre)
    const removedTabs = ["agent-builder", "research-lab", "knowledge-base", "team", "account", "templates", "format-rules", "repurpose", "canvas", "analytics"];
    if (removedTabs.includes(tab)) {
      shouldRedirect = true;
      if (tab === "analytics") redirectTab = "performance";
    }

    // Tabs reorganizadas 2026-05-09 — viraram sections em Settings ou
    // sub-tabs no Perfil do Cliente. Redirect inline preserva bookmarks.
    // workspace-settings/workspace-members/radar-sources-admin/mcp → Settings
    // hashtags/competitors/reports → Perfil do Cliente (tab Viral)
    const redirectToSettings: Record<string, string> = {
      "workspace-settings": "workspace",
      "workspace-members": "members",
      "radar-sources-admin": "radar-sources",
      "mcp": "mcp",
    };
    if (tab in redirectToSettings) {
      const params = new URLSearchParams(searchParams);
      params.set("tab", "settings");
      params.set("section", redirectToSettings[tab]);
      setSearchParams(params);
      return;
    }
    // Hashtags/Concorrentes/Relatórios viraram per-client. Sem cliente
    // selecionado, manda pra perfis. Com cliente, manda pra performance
    // (que ainda funciona globalmente).
    const removedClientTabs = ["hashtags", "competitors", "reports"];
    if (removedClientTabs.includes(tab)) {
      shouldRedirect = true;
      redirectTab = "performance";
    }
    
    // Home requires canViewHome
    if (tab === "home" && !canViewHome) {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    // Performance requires canViewPerformance — antes não tinha gate (qualquer
    // role acessava direto via ?tab=performance). Audit 2026-05-18.
    if (tab === "performance" && !canViewPerformance) {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    // Repurpose requires canViewRepurpose
    if (tab === "repurpose" && !canViewRepurpose) {
      shouldRedirect = true;
      redirectTab = "planning";
    }

    // 2026-05-18 — `tab=clients` voltou a renderizar inline no shell
    // (audit C1 reverteu rota dedicada que quebrava sidebar). Permission
    // check fica no early-return logo no topo deste effect.

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

    // Billing tab removida — caso alguém ainda navegue via URL antiga,
    // redireciona pro Settings → workspace section (info do plano + admin).
    if (tab === "billing") {
      shouldRedirect = true;
      redirectTab = "settings";
      // section=workspace é setado pelo handler do tab=billing nos chamadores
      // (UpgradePrompt, next-link shim, next-navigation shim) via search params
      // — aqui só garantimos que a tab final é settings.
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
  }, [tab, clientId, canViewClients, canManageTeam, canViewHome, canViewRepurpose, isViewer, isOwner, isLoadingWorkspace, isSuperAdmin, searchParams, setSearchParams, navigate]);


  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", isViewer && newTab !== "planning" ? "planning" : newTab);
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

  // Auto-select first client if none selected.
  // 2026-05-17 — audit Dt-4: setSearchParams nas deps em vez de
  // handleClientChange (que e re-criada todo render — gera loop infinito se
  // entrar nas deps). setSearchParams e estavel via React-Router. Mantemos
  // a chamada direta em vez de extrair handleClientChange p/ useCallback
  // pq evita re-render cascade.
  useEffect(() => {
    if (!clientId && clients && clients.length > 0) {
      const params = new URLSearchParams(searchParams);
      params.set("client", clients[0].id);
      setSearchParams(params);
    }
  }, [clientId, clients, searchParams, setSearchParams]);


  const renderContent = () => {
    if (isLoadingClients) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Tools that don't need client (ou que precisam mas tem fallback interno).
    // Tab Viral única no KAI:
    //   viral-carrossel = Sequência Viral (gerador de carrossel)
    // 2026-05-16: Reels e Radar removidos do KAI (apps separados em
    // reels.kaleidos.com.br e radar.kaleidos.com.br).
    // viral-library removida em 2026-05-08 — unificada com biblioteca normal
    // do cliente (client_reference_library) com scenes/slides/format.
    const toolTabs = [
      "settings", "automations", "assistant", "home", "clients",
      "viral-carrossel",
      // Metricool: só inbox unificado fica global (push notifications de DMs).
      "inbox",
      // 2026-05-09: removidos workspace-settings, workspace-members,
      // radar-sources-admin (viraram sections em Settings); hashtags,
      // competitors, reports (viraram per-client no Perfil → Viral);
      // mcp (virou section em Settings → Sistema → MCP kAI).
      // 2026-05-18: "clients" RESTAURADO inline (fix sidebar bug).
    ];

    if (toolTabs.includes(tab)) {
      switch (tab) {
        case "viral-carrossel":
          return selectedClient ? (
            <ViralFeatureGate feature="sequencia">
              <div className="h-full overflow-hidden">
                <ViralSequenceTab
                  key={selectedClient.id}
                  clientId={selectedClient.id}
                  client={selectedClient}
                  carouselId={carouselId}
                />
              </div>
            </ViralFeatureGate>
          ) : (
            <ClientRequiredEmpty message="Escolha um cliente na sidebar para gerar carrosséis com voz e estilo dele." />
          );
        // 2026-05-16 — cases "viral-reels-page" e "viral-radar-page" removidos.
        // Aliases redirecionam ambos pra "viral-carrossel" no useEffect acima.
        // case "mcp" removido 2026-05-09 — agora é section dentro de Settings
        // (Settings → Sistema → MCP kAI). Tab antigo redireciona via useEffect.
        case "inbox":
          return selectedClient ? (
            <MetricoolInboxPanel clientId={selectedClient.id} />
          ) : (
            <ClientRequiredEmpty message="Selecione um cliente pra ver o Inbox unificado." />
          );
        // 'editorial-calendar' case removido — virou sub-tab dentro de Planejamento
        // 'smart-links' case removido — feature mantida no código mas sem rota
        // 'linkinbio' case removido — feature dispensada pelo usuário
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
              onSelectClient={(clientId, nextTab) => {
                const params = new URLSearchParams(searchParams);
                params.set("client", clientId);
                if (nextTab) params.set("tab", nextTab);
                setSearchParams(params);
              }}
            />
          );
        case "clients":
          // 2026-05-18 — RESTAURADO inline. Antes era rota dedicada que perdia
          // sidebar; agora monta dentro do shell preservando navegação.
          // redirectOnComplete=false porque a navegação fica via tab state.
          return <ClientsListPage redirectOnComplete={false} />;
        case "settings":
          return <SettingsTab />;
        case "automations":
          return <AutomationsTab />;
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
            onSelectClient={(clientId, nextTab) => {
              const params = new URLSearchParams(searchParams);
              params.set("client", clientId);
              if (nextTab) params.set("tab", nextTab);
              setSearchParams(params);
            }}
          />
        );
    }
  };

  // Respeita prefers-reduced-motion: zera duração das transições de tab.
  // Acessibilidade WCAG 2.3.3 — usuários sensíveis a movimento não devem
  // ter animações forçadas.
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex h-dvh bg-background w-full">
      {/* Skip link — primeiro elemento focável. Tab no carregamento mostra o
          link "Pular para o conteúdo principal" que pula sidebar/header. */}
      <SkipLink />

      {/* Onboarding Flow + Notification Permission Prompt — lazy, Suspense null.
          Não competem com o first paint do shell (sidebar/header). */}
      <Suspense fallback={null}>
        <OnboardingFlow />
        <NotificationPermissionPrompt />
      </Suspense>
      
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
          // 2026-05-16 — audit Mob-8: pb-16 fixo deixava conteúdo escondido
          // atrás do MobileBottomNav em iPhones com home indicator (nav
          // cresce pra ~84px com safe-area, main só reservava 64px). Agora
          // calc soma o env(safe-area-inset-bottom) — funciona em todo device.
          isMobile && "pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
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
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                  animate={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" }}
                  className="h-full min-h-0"
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
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
