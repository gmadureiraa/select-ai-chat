/**
 * usePlanFeatures - Sistema interno Kaleidos
 * 
 * Este hook foi simplificado para sempre retornar acesso total.
 * O sistema de planos (Canvas/Pro/Enterprise) foi desativado.
 * As permissões agora são baseadas apenas em roles (admin/member/viewer).
 */
export interface PlanFeatures {
  isEnterprise: boolean;
  isPro: boolean;
  isCanvas: boolean;
  hasPlanning: boolean;
  hasCalendar: boolean;
  hasKanban: boolean;
  hasSocialPublishing: boolean;
  canAccessProfiles: boolean;
  canAccessPerformance: boolean;
  canAccessLibrary: boolean;
  canAccessKaiChat: boolean;
  canCreateProfiles: boolean;
  planType: string | null;
  isLoading: boolean;
}

export function usePlanFeatures(): PlanFeatures {
  // Sistema interno - acesso total a todas as features
  // As permissões são controladas por roles em useWorkspace.ts
  return {
    isEnterprise: true,
    isPro: true,
    isCanvas: false,
    hasPlanning: true,
    hasCalendar: true,
    hasKanban: true,
    hasSocialPublishing: true,
    canAccessProfiles: true,
    canAccessPerformance: true,
    canAccessLibrary: true,
    canAccessKaiChat: true,
    canCreateProfiles: true,
    planType: 'internal',
    isLoading: false,
  };
}
