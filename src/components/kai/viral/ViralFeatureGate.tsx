/**
 * ViralFeatureGate — wrapper que bloqueia o conteúdo quando o user não tem
 * permissão pra usar a feature (plano não tem flag, ou role é viewer).
 *
 * 2026-05-16: features `reels` e `radar` removidas (saíram do KAI; viraram
 * apps standalone em reels.kaleidos.com.br e radar.kaleidos.com.br).
 * Resta só `sequencia` (carrossel).
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
import { UpgradePrompt } from "./UpgradePrompt";

type ViralFeatureKey = "sequencia";

interface ViralFeatureGateProps {
  feature: ViralFeatureKey;
  children: React.ReactNode;
  /** Mostra prompt mesmo durante loading (default: false → null). */
  showOnLoading?: boolean;
}

export function ViralFeatureGate({ feature: _feature, children, showOnLoading = false }: ViralFeatureGateProps) {
  const access = useViralAccess();

  if (access.isLoading && !showOnLoading) return null;

  if (!access.canUseSequencia) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <UpgradePrompt feature="viral_carousel" reason={access.reasonSequencia} />
      </div>
    );
  }

  return <>{children}</>;
}
