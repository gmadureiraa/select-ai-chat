/**
 * Radar Viral — entry point dentro do KAI.
 *
 * Cópia LITERAL do app standalone (`code/radar-viral/`), preservando
 * UI/CSS/cores/fontes/layouts ~95%+. Adaptações mínimas:
 *
 *   - Sem Next.js (Vite), Link/useRouter shimados via lib/next-shims
 *   - Auth via Supabase em vez de Neon Auth (lib/auth-client adapter)
 *   - 4 sub-views (Dashboard, Saved, Newsletters, Admin) trocadas por
 *     state local em vez de routing /app, /app/saved, etc.
 *   - CSS isolado em `styles/globals.css` carregado top-level + scope
 *     `.rdv-shell` no root pra evitar leakage no resto do KAI.
 *
 * Props clientId/client são aceitas por compatibilidade com a tab
 * antiga (KAI passa o cliente selecionado), mas o Radar opera por
 * NICHO global (crypto/marketing/ai), não por cliente — então clientId
 * é só registrado no log e ignorado pra fins de query.
 */

import { lazy, Suspense, useState } from "react";
import {
  LayoutDashboard,
  Mail,
  Shield,
  Menu,
  X,
  LogOut,
  Loader2,
} from "lucide-react";

import "./styles/globals.css";

import { NicheProvider, useActiveNiche } from "./lib/niche-context";
import { useNeonSession, signOutAndReset } from "./lib/auth-client";
import { isAdminEmail } from "./lib/admin-emails";

// Dashboard é eager (default landing); Newsletters/Admin lazy pra reduzir o
// initial chunk. Admin tem 1162 linhas de tabelas/forms que só super-admin
// precisa carregar. Newsletter é só lista linkada — peso pequeno mas não
// justifica pagar no first paint do Radar.
//
// 2026-05-09: Tab "Salvos" REMOVIDA. Substituida pela Biblioteca do KAI
// (`KaiLibraryTab`) — ações "Salvar na biblioteca" e "Ideia em planejamento"
// agora vivem nos cards do dashboard via <CrossAppActions />, eliminando
// duplicação. Bookmarks legados continuam acessíveis via /api/data/saved
// pra compat, mas não há mais UI de listagem.
import DashboardPage from "./pages/Dashboard";
const NewslettersPage = lazy(() => import("./pages/Newsletters"));
const AdminPage = lazy(() => import("./pages/Admin"));

import type { Client } from "@/hooks/useClients";

// KAI integration: header + context loader (cliente atual selecionado).
import { useClientWorkspaceContext } from "@/components/kai/viral/lib/use-client-workspace-context";
import { ClientContextHeader } from "@/components/kai/viral/ClientContextHeader";

/**
 * ViewId — tabs internas do Radar.
 *
 * 2026-05-09:
 *   - tab "sources" removida (config per-client mudou pra tab "Viral" do
 *     Perfil do Cliente — ClientViralSettingsTab).
 *   - tab "salvos" removida — substituida pela Biblioteca do KAI. Ações
 *     "Salvar na biblioteca" e "Criar ideia" agora ficam direto no dash
 *     via <CrossAppActions />.
 */
type ViewId = "dashboard" | "newsletters" | "admin";

interface NavItem {
  id: ViewId;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  adminOnly?: boolean;
}

/**
 * NAV: 1 grupo só no KAI (no standalone tinha PRIMARY+SECONDARY mas
 * Settings/Pricing/Referrals do standalone não fazem sentido aqui — o
 * KAI já tem suas páginas próprias pra isso). Mantemos as 4 views
 * funcionais do Radar (Dashboard, Saved, Newsletters, Admin).
 */
const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "newsletters", label: "Newsletters", icon: Mail },
  { id: "admin", label: "Admin", icon: Shield, badge: "DEV", adminOnly: true },
];

interface MainAppProps {
  clientId?: string;
  client?: Client;
}

export default function MainApp({ clientId, client }: MainAppProps) {
  return (
    <NicheProvider>
      <RadarShell clientId={clientId ?? null} clientName={client?.name ?? null} />
    </NicheProvider>
  );
}

function RadarShell({
  clientId,
  clientName,
}: {
  clientId: string | null;
  clientName: string | null;
}) {
  const session = useNeonSession();
  const [view, setView] = useState<ViewId>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  // KAI context — header banner com cliente atual. Radar dashboard é
  // nicho-driven (crypto/marketing/ai); fontes per-client foram movidas
  // pro Perfil do Cliente (tab Viral).
  void clientName; // silencia unused: prop ainda aceita pra compatibilidade
  const { data: clientCtx } = useClientWorkspaceContext(clientId);

  const isAdmin = isAdminEmail(session.data?.user?.email);
  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin);
  const closeDrawer = () => setMobileOpen(false);

  const renderView = () => {
    switch (view) {
      case "dashboard":
        return <DashboardPage clientId={clientId} />;
      case "newsletters":
        return (
          <Suspense fallback={<RadarLazyFallback />}>
            <NewslettersPage />
          </Suspense>
        );
      case "admin":
        return (
          <Suspense fallback={<RadarLazyFallback />}>
            <AdminPage />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rdv-shell" style={{ display: "flex", minHeight: "100%", height: "100%", background: "var(--color-rdv-paper)", overflow: "auto" }}>
      {/* Sidebar desktop */}
      <aside
        className="rdv-sidebar-desktop"
        style={{
          width: 232,
          flexShrink: 0,
          background: "var(--color-rdv-ink)",
          color: "var(--color-rdv-paper)",
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SidebarContent
          activeView={view}
          onSelect={(v) => {
            setView(v);
            closeDrawer();
          }}
          navItems={navItems}
          userEmail={session.data?.user.email ?? ""}
          userName={session.data?.user.name ?? null}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          onClick={closeDrawer}
          className="rdv-sidebar-mobile-backdrop"
          style={{ position: "fixed", inset: 0, background: "rgba(10,9,8,0.55)", zIndex: 60 }}
        />
      )}
      <aside
        className="rdv-sidebar-mobile"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: 232,
          background: "var(--color-rdv-ink)",
          color: "var(--color-rdv-paper)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s ease",
          zIndex: 70,
        }}
      >
        <SidebarContent
          activeView={view}
          onSelect={(v) => {
            setView(v);
            closeDrawer();
          }}
          navItems={navItems}
          userEmail={session.data?.user.email ?? ""}
          userName={session.data?.user.name ?? null}
          showCloseButton
          onClose={closeDrawer}
        />
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <header
          className="rdv-app-mobile-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--color-rdv-paper)",
            borderBottom: "1.5px solid var(--color-rdv-ink)",
          }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            style={{
              border: "1.5px solid var(--color-rdv-ink)",
              padding: 8,
              cursor: "pointer",
              background: "transparent",
            }}
          >
            <Menu size={16} />
          </button>
          <div className="rdv-eyebrow">
            <span className="rdv-rec-dot" /> RADAR VIRAL
          </div>
          <div style={{ width: 32 }} />
        </header>

        {/* KAI banner: cliente selecionado + tom (informativo no Radar) */}
        <ClientContextHeader context={clientCtx ?? null} variant="light" />

        <div>{renderView()}</div>
      </main>
    </div>
  );
}

function SidebarContent({
  activeView,
  onSelect,
  navItems,
  userEmail,
  userName,
  showCloseButton,
  onClose,
}: {
  activeView: ViewId;
  onSelect: (v: ViewId) => void;
  navItems: NavItem[];
  userEmail: string;
  userName: string | null;
  showCloseButton?: boolean;
  onClose?: () => void;
}) {
  const handleSignOut = async () => {
    await signOutAndReset();
  };

  function renderNavLink({ id, label, icon: Icon, badge }: NavItem) {
    const active = activeView === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelect(id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 10px",
          background: active ? "var(--color-rdv-rec)" : "transparent",
          color: active ? "white" : "rgba(245,241,232,0.72)",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
          textDecoration: "none",
          border: "none",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          boxShadow: active ? "2px 2px 0 0 rgba(0,0,0,0.3)" : "none",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        <Icon size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
        {badge && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "1px 6px",
              background: active ? "rgba(0,0,0,0.18)" : "var(--color-rdv-rec)",
              color: "white",
            }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "22px 18px 20px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 18,
          marginBottom: 14,
          borderBottom: "1px solid rgba(245,241,232,0.12)",
        }}
      >
        <button
          type="button"
          onClick={() => onSelect("dashboard")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--color-rdv-paper)",
            padding: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-rdv-rec)",
              boxShadow: "0 0 8px var(--color-rdv-rec)",
            }}
          />
          <span className="rdv-display" style={{ fontSize: 22, lineHeight: 1, letterSpacing: "-0.02em" }}>
            Radar <em>Viral</em>
          </span>
        </button>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(245,241,232,0.7)" }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      <NicheSwitcher />

      <div
        style={{
          padding: "8px 4px 6px",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(245,241,232,0.4)",
          fontWeight: 700,
          marginTop: 14,
        }}
      >
        Workspace
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map(renderNavLink)}
      </nav>

      <div style={{ flex: 1, minHeight: 24 }} />

      <div
        style={{
          padding: "12px 12px",
          border: "1px solid rgba(245,241,232,0.18)",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 8.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(245,241,232,0.4)",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          Logado
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-rdv-paper)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={userEmail}
        >
          {userName ?? userEmail.split("@")[0]}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "rgba(245,241,232,0.5)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {userEmail}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "9px 12px",
          background: "transparent",
          color: "rgba(245,241,232,0.5)",
          border: "1px solid rgba(245,241,232,0.14)",
          fontFamily: "var(--font-geist-mono)",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <LogOut size={11} /> Sair
      </button>
    </div>
  );
}

function NicheSwitcher() {
  const { active, setActive, niches } = useActiveNiche();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "rgba(245,241,232,0.05)",
          border: "1px solid rgba(245,241,232,0.18)",
          color: "var(--color-rdv-paper)",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: active.color,
            boxShadow: `0 0 6px ${active.color}`,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 700 }}>
          {active.emoji} {active.label}
        </span>
        <span
          className="rdv-mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.16em",
            color: "rgba(245,241,232,0.5)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--color-rdv-coal)",
            border: "1px solid rgba(245,241,232,0.18)",
            zIndex: 10,
            boxShadow: "4px 4px 0 0 rgba(255, 61, 46, 0.4)",
          }}
        >
          {niches.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setActive(n.id);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: n.id === active.id ? "rgba(255, 61, 46, 0.15)" : "transparent",
                border: "none",
                color: "var(--color-rdv-paper)",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 11,
                fontWeight: n.id === active.id ? 700 : 500,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: n.color,
                  flexShrink: 0,
                }}
              />
              <span>
                {n.emoji} {n.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RadarLazyFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 320,
      }}
    >
      <Loader2
        size={20}
        style={{ color: "var(--color-rdv-rec)" }}
        className="animate-spin"
      />
    </div>
  );
}

// Named export pra retrocompatibilidade com o pattern do tab antigo:
//   import { ViralRadarTab } from "@/components/kai/viral-radar-original/MainApp"
export { MainApp as ViralRadarTab };
