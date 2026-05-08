/**
 * ViralFeatureGate — wrapper que bloqueia o conteúdo quando o user não tem
 * permissão pra usar a feature (plano não tem flag, ou role é viewer).
 *
 * Uso no Kai.tsx:
 *
 *   case "viral-carrossel":
 *     return (
 *       <ViralFeatureGate feature="sequencia">
 *         <ViralSequenceTab clientId={...} client={...} />
 *       </ViralFeatureGate>
 *     );
 *
 * Durante loading retorna null (evita flash de UpgradePrompt). Caller pode
 * envolver com Suspense pra mostrar fallback.
 */
import { useViralAccess } from "@/hooks/useViralAccess";
import { UpgradePrompt, type UpgradeFeature } from "./UpgradePrompt";

type ViralFeatureKey = "sequencia" | "reels" | "radar";

interface ViralFeatureGateProps {
  feature: ViralFeatureKey;
  children: React.ReactNode;
  /** Mostra prompt mesmo durante loading (default: false → null). */
  showOnLoading?: boolean;
}

const FEATURE_TO_UPGRADE_KEY: Record<ViralFeatureKey, UpgradeFeature> = {
  sequencia: "viral_carousel",
  reels: "viral_reels",
  radar: "viral_radar",
};

export function ViralFeatureGate({ feature, children, showOnLoading = false }: ViralFeatureGateProps) {
  const access = useViralAccess();

  if (access.isLoading && !showOnLoading) return null;

  const allowed =
    feature === "sequencia"
      ? access.canUseSequencia
      : feature === "reels"
      ? access.canUseReels
      : access.canUseRadar;

  const reason =
    feature === "sequencia"
      ? access.reasonSequencia
      : feature === "reels"
      ? access.reasonReels
      : access.reasonRadar;

  if (!allowed) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <UpgradePrompt feature={FEATURE_TO_UPGRADE_KEY[feature]} reason={reason} />
      </div>
    );
  }

  return <>{children}</>;
}
