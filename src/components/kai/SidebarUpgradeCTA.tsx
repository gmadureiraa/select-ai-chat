/**
 * SidebarUpgradeCTA - Sistema interno Kaleidos
 * 
 * Este componente foi desativado pois não há mais planos de upgrade.
 * Mantido para compatibilidade de imports, mas sempre retorna null.
 */

interface SidebarUpgradeCTAProps {
  collapsed?: boolean;
  planName?: string;
}

export function SidebarUpgradeCTA({ collapsed, planName }: SidebarUpgradeCTAProps) {
  // Sistema interno - não exibir CTA de upgrade
  return null;
}
