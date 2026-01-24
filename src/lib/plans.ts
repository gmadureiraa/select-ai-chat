// Constantes centralizadas de planos - FONTE ÚNICA DA VERDADE
// Stripe Price IDs e Product IDs estão em create-checkout/index.ts

export const PLAN_CONFIG = {
  canvas: {
    name: "Canvas",
    displayName: "Canvas",
    price: 19.90,
    priceFormatted: "$19.90",
    description: "Para criadores solo",
    dbType: "starter", // tipo no banco de dados
    checkoutType: "basic", // tipo enviado para create-checkout
    maxClients: 1,
    maxMembers: 1,
    features: [
      "Canvas ilimitado",
      "IA multi-agente",
      "Geração de imagens",
      "Templates prontos",
      "1 perfil de cliente",
    ],
    shortFeatures: ["1 perfil", "Canvas ilimitado", "IA avançada"],
  },
  pro: {
    name: "Pro",
    displayName: "kAI PRO",
    price: 99.90,
    priceFormatted: "$99.90",
    description: "Suite completa para agências e times",
    dbType: "pro",
    checkoutType: "agency", // tipo enviado para create-checkout
    maxClients: 10,
    maxMembers: 5,
    features: [
      "Tudo do Canvas",
      "3 perfis (+$7/extra)",
      "3 membros (+$4/extra)",
      "Planejamento Kanban",
      "Calendário editorial",
      "Performance Analytics",
      "Biblioteca de conteúdo",
      "Publicação automática",
      "Integrações sociais",
      "API access",
    ],
    shortFeatures: ["10 perfis", "5 membros", "Analytics + Biblioteca"],
  },
  enterprise: {
    name: "Enterprise",
    displayName: "Enterprise",
    price: null, // Preço customizado
    priceFormatted: "Sob consulta",
    description: "Soluções customizadas para grandes equipes",
    dbType: "enterprise",
    checkoutType: null, // Não tem checkout - contato direto
    maxClients: 999,
    maxMembers: 999,
    features: [
      "Tudo do Pro",
      "Perfis ilimitados",
      "Membros ilimitados",
      "Suporte prioritário",
      "Onboarding dedicado",
      "SLA customizado",
    ],
    shortFeatures: ["Ilimitado", "Suporte VIP", "SLA"],
  },
} as const;

// Tipo para planos
export type PlanKey = keyof typeof PLAN_CONFIG;

// Contato de vendas
export const SALES_CONTACT = {
  whatsapp: "https://api.whatsapp.com/send/?phone=12936180547&text=Olá! Gostaria de saber mais sobre o plano Enterprise do kAI",
  calendly: "https://calendly.com/madureira-kaleidosdigital/30min",
};

// Helper para obter plano por tipo do banco
export function getPlanByDbType(dbType: string) {
  return Object.values(PLAN_CONFIG).find((plan) => plan.dbType === dbType);
}

// Helper para obter plano por tipo de checkout
export function getPlanByCheckoutType(checkoutType: string) {
  return Object.values(PLAN_CONFIG).find((plan) => plan.checkoutType === checkoutType);
}
