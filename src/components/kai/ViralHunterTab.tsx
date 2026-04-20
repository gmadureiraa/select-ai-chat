/**
 * Viral Hunter — dashboard de descoberta e ideação.
 *
 * Tabs:
 *   - Overview    — posts virais do próprio cliente
 *   - Concorrentes — CRUD de competitors do nicho
 *   - YouTube     — busca vídeos virais por keywords (YT Data API v3)
 *   - Notícias    — Google News RSS por keywords
 *   - Tendências  — placeholder (futuro: Google Trends)
 *   - Ideas       — lista ideias do planning + botão gerar com KAI
 *
 * Cada tab tem seus próprios dados/callbacks. O componente compartilha a
 * config de keywords/concorrentes via useViralHunterConfig (persiste em
 * client.tags.viral_hunter).
 */

import { useState } from "react";
import { Flame, Users, Youtube, Newspaper, TrendingUp, Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@/hooks/useClients";
import { TabOverview } from "./viral-hunter/TabOverview";
import { TabCompetitors } from "./viral-hunter/TabCompetitors";
import { TabYouTube } from "./viral-hunter/TabYouTube";
import { TabNews } from "./viral-hunter/TabNews";
import { TabIdeas } from "./viral-hunter/TabIdeas";
import type { ViralHunterTabId } from "./viral-hunter/types";

interface ViralHunterTabProps {
  clientId: string;
  client: Client;
  onUseAsInspiration?: (prompt: string) => void;
}

interface TabDef {
  id: ViralHunterTabId;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: Flame, description: "Meus posts de maior engajamento" },
  { id: "competitors", label: "Concorrentes", icon: Users, description: "Perfis do nicho pra monitorar" },
  { id: "youtube", label: "YouTube", icon: Youtube, description: "Vídeos virais por keywords" },
  { id: "news", label: "Notícias", icon: Newspaper, description: "Google News do nicho em tempo real" },
  { id: "trends", label: "Tendências", icon: TrendingUp, description: "Termos em alta (em breve)" },
  { id: "ideas", label: "Ideas", icon: Lightbulb, description: "Gerar e gerenciar ideias de conteúdo" },
];

export const ViralHunterTab = ({
  clientId,
  client,
  onUseAsInspiration,
}: ViralHunterTabProps) => {
  const [active, setActive] = useState<ViralHunterTabId>("overview");
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];

  const handleInspire = (prompt: string) => {
    if (onUseAsInspiration) onUseAsInspiration(prompt);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/30 bg-background/60 backdrop-blur-sm px-6 py-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Viral Hunter
              <span className="text-xs font-normal text-muted-foreground">·</span>
              <span className="text-xs font-normal text-muted-foreground">{client.name}</span>
            </h2>
            <p className="text-xs text-muted-foreground">{tab.description}</p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-background hover:bg-muted border border-border text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {active === "overview" && (
          <TabOverview clientId={clientId} client={client} onUseAsInspiration={handleInspire} />
        )}
        {active === "competitors" && (
          <TabCompetitors clientId={clientId} onUseAsInspiration={handleInspire} />
        )}
        {active === "youtube" && (
          <TabYouTube clientId={clientId} onUseAsInspiration={handleInspire} />
        )}
        {active === "news" && (
          <TabNews clientId={clientId} onUseAsInspiration={handleInspire} />
        )}
        {active === "trends" && <TrendsPlaceholder />}
        {active === "ideas" && (
          <TabIdeas clientId={clientId} clientName={client.name} onUseAsInspiration={handleInspire} />
        )}
      </div>
    </div>
  );
};

function TrendsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto gap-3">
      <div className="p-4 rounded-full bg-muted">
        <TrendingUp className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">Tendências em breve</h3>
      <p className="text-sm text-muted-foreground">
        Vamos plugar Google Trends aqui pra ver os termos do nicho em alta nos últimos 7/30 dias.
        Próximo sprint.
      </p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
        <Sparkles className="h-3.5 w-3.5" />
        Dica: enquanto isso, use "Notícias" + "YouTube" pra puxar o que está em alta.
      </div>
    </div>
  );
}
