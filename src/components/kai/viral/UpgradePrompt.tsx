/**
 * UpgradePrompt — card mostrado quando o user tenta acessar uma feature
 * bloqueada pelo plano (Free não tem viral_carousel, etc) ou viewer tenta criar.
 *
 * 2026-05-16: viral_reels e viral_radar removidos (saíram do KAI; apps
 * standalone em reels.kaleidos.com.br e radar.kaleidos.com.br).
 *
 * Variants:
 *   - feature='viral_carousel' → upgrade plano
 *   - feature='tokens' → tokens mensais esgotados
 *   - feature='clients' → atingiu max_clients do plano
 *
 * Props opcionais permitem override do CTA pra workflows específicos
 * (ex: "Esgotou tokens, espera reset em 15 dias").
 */
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, ArrowRight, AlertCircle, Users, Coins } from "lucide-react";

export type UpgradeFeature =
  | "viral_carousel"
  | "tokens"
  | "clients";

interface UpgradePromptProps {
  feature: UpgradeFeature;
  reason?: string;
  message?: string;
  /** Esconde botão "Saiba mais" quando true (modal contexts). */
  compact?: boolean;
}

const FEATURE_NAMES: Record<UpgradeFeature, string> = {
  viral_carousel: "Sequência Viral",
  tokens: "créditos mensais",
  clients: "limite de clientes",
};

const FEATURE_ICONS: Record<UpgradeFeature, React.ComponentType<{ className?: string }>> = {
  viral_carousel: Lock,
  tokens: Coins,
  clients: Users,
};

const FEATURE_DEFAULT_MSG: Record<UpgradeFeature, string> = {
  viral_carousel:
    "Esta feature está disponível em planos pagos. Faça upgrade pra desbloquear Sequência Viral e gerar carrosséis ilimitados.",
  tokens:
    "Você atingiu o limite mensal de créditos do seu plano. Faça upgrade ou aguarde o reset mensal pra continuar gerando conteúdo.",
  clients:
    "Você atingiu o limite de clientes do seu plano. Faça upgrade pra adicionar mais clientes ao workspace.",
};

export function UpgradePrompt({ feature, reason, message, compact = false }: UpgradePromptProps) {
  const [, setSearchParams] = useSearchParams();
  const featureName = FEATURE_NAMES[feature];
  const Icon = reason === "role_viewer" ? AlertCircle : FEATURE_ICONS[feature];

  const isViewerBlocked = reason === "role_viewer";
  const headline = isViewerBlocked
    ? `Acesso somente leitura`
    : feature === "tokens"
    ? "Créditos esgotados"
    : feature === "clients"
    ? "Limite de clientes atingido"
    : `Faça upgrade pra acessar ${featureName}`;

  const body = isViewerBlocked
    ? `Como viewer, você pode visualizar mas não pode criar conteúdo em ${featureName}. Peça pro admin do workspace promover seu acesso.`
    : message || FEATURE_DEFAULT_MSG[feature];

  // KAI 2.0 é uso interno Kaleidos sem cobrança por workspace — BillingTab
  // foi removido em 2026-05-09. Redireciona pro tab Settings → workspace
  // onde admin/owner pode ver info do plano + ajustar limites.
  const goToBilling = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "settings");
      next.set("section", "workspace");
      return next;
    });
  };

  return (
    <Card className="p-6 max-w-md mx-auto text-center">
      <div className="flex justify-center mb-4">
        <div className="p-3 rounded-full bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">{headline}</h3>
      <p className="text-sm text-muted-foreground mb-6">{body}</p>
      {!isViewerBlocked && (
        <div className="flex flex-col gap-2">
          <Button onClick={goToBilling} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Ver workspace
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          {!compact && (
            <Button
              variant="ghost"
              onClick={goToBilling}
              className="w-full text-xs"
            >
              Saiba mais
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
