/**
 * useViralAccess — Hook central de permissões/limits/tokens pra os 3 viral apps.
 *
 * Composto a partir de:
 *   - workspace_subscriptions  → plano vigente (free/starter/pro/enterprise)
 *   - subscription_plans       → flags de feature + limites (max_clients, max_members, tokens_monthly)
 *   - workspace_members        → role do user no workspace (owner/admin/member/viewer)
 *   - workspace_tokens         → balance + tokens_used_this_period + monthly_quota
 *   - clients (count)          → uso atual de slots de cliente
 *
 * Uso:
 *   const access = useViralAccess();
 *   if (!access.canUseSequencia) return <UpgradePrompt feature="viral_carousel" />;
 *   if (access.tokensExhausted) return <TokensExhaustedPrompt />;
 *
 * Importante:
 *   - Não bloqueia READ (só create/publish). Viewer ainda vê histórico.
 *   - Radar leitura é permitida pra qualquer plan diferente de free (Starter+).
 *   - `clientsRemaining = Infinity` quando max_clients = -1 (Enterprise).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";

export type ViralPlanType = "free" | "starter" | "pro" | "enterprise";
export type ViralRole = "owner" | "admin" | "member" | "viewer";

export interface ViralAccess {
  // Feature gates
  canUseSequencia: boolean;
  canUseReels: boolean;
  canUseRadar: boolean;
  reasonSequencia?: string;
  reasonReels?: string;
  reasonRadar?: string;

  // Plan info
  planType: ViralPlanType;
  planName: string;
  clientsLimit: number; // -1 = unlimited (mas usamos Infinity em clientsRemaining)
  clientsCount: number;
  clientsRemaining: number;
  membersLimit: number;

  // Tokens (mensais)
  monthlyTokens: number;
  tokensUsed: number;
  tokensRemaining: number;
  tokensExhausted: boolean;

  // Role / permissões
  role: ViralRole;
  isOwner: boolean;
  isAdmin: boolean;
  canCreate: boolean; // owner | admin | member
  canPublish: boolean; // mesmo critério (publishing flow ainda não tem fine-grained)

  isLoading: boolean;
}

/** Custos em tokens de cada operação viral. Espelha api/_lib/shared/tokens.ts */
export const VIRAL_TOKEN_COSTS = {
  carousel: 50,
  reel: 20,
  brief: 10,
  image: 5,
} as const;

const DEFAULT_ACCESS: ViralAccess = {
  canUseSequencia: false,
  canUseReels: false,
  canUseRadar: false,
  planType: "free",
  planName: "Free",
  clientsLimit: 1,
  clientsCount: 0,
  clientsRemaining: 0,
  membersLimit: 1,
  monthlyTokens: 100,
  tokensUsed: 0,
  tokensRemaining: 100,
  tokensExhausted: false,
  role: "viewer",
  isOwner: false,
  isAdmin: false,
  canCreate: false,
  canPublish: false,
  isLoading: true,
};

export function useViralAccess(): ViralAccess {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const userId = user?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["viral-access", workspaceId, userId],
    enabled: !!workspaceId && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [subRes, memberRes, tokensRes, clientsRes] = await Promise.all([
        supabase
          .from("workspace_subscriptions")
          .select("status, plan_id, subscription_plans(*)")
          .eq("workspace_id", workspaceId!)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", workspaceId!)
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("workspace_tokens")
          .select("balance, tokens_used_this_period, monthly_quota")
          .eq("workspace_id", workspaceId!)
          .maybeSingle(),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId!),
      ]);

      const sub = subRes.data as any;
      const plan = sub?.subscription_plans;
      const features = (plan?.features as Record<string, boolean>) || {};
      const role = ((memberRes.data?.role as ViralRole) || "viewer") as ViralRole;
      const tokens = (tokensRes.data as any) || {
        balance: 0,
        tokens_used_this_period: 0,
        monthly_quota: 100,
      };
      const clientsCount = clientsRes.count ?? 0;

      const planType = ((plan?.type as ViralPlanType) || "free") as ViralPlanType;
      const isOwner = role === "owner";
      const isAdmin = role === "admin";
      const canCreate = role === "owner" || role === "admin" || role === "member";

      const clientsLimit: number = plan?.max_clients ?? 1;
      const clientsRemaining =
        clientsLimit === -1 ? Infinity : Math.max(0, clientsLimit - clientsCount);

      const monthlyQuota: number = tokens.monthly_quota ?? 100;
      const tokensUsed: number = tokens.tokens_used_this_period ?? 0;
      const tokensRemaining = Math.max(0, monthlyQuota - tokensUsed);
      const tokensExhausted = tokensUsed >= monthlyQuota;

      const canUseSequencia = !!features.viral_carousel && canCreate;
      const canUseReels = !!features.viral_reels && canCreate;
      // Radar: leitura permitida pra qualquer plano pago (Starter+); free só com flag explícita.
      // Mas pra agir (criar brief, salvar), também precisa canCreate.
      const canUseRadar = (!!features.viral_radar || planType !== "free") && canCreate;

      const reasonSequencia = !features.viral_carousel
        ? "upgrade_plan"
        : !canCreate
        ? "role_viewer"
        : undefined;
      const reasonReels = !features.viral_reels
        ? "upgrade_plan"
        : !canCreate
        ? "role_viewer"
        : undefined;
      const reasonRadar = !features.viral_radar && planType === "free"
        ? "upgrade_plan"
        : !canCreate
        ? "role_viewer"
        : undefined;

      const access: Omit<ViralAccess, "isLoading"> = {
        planType,
        planName: plan?.name ?? "Free",
        clientsLimit,
        clientsCount,
        clientsRemaining,
        membersLimit: plan?.max_members ?? 1,

        monthlyTokens: monthlyQuota,
        tokensUsed,
        tokensRemaining,
        tokensExhausted,

        role,
        isOwner,
        isAdmin,
        canCreate,
        canPublish: canCreate,

        canUseSequencia,
        canUseReels,
        canUseRadar,
        reasonSequencia,
        reasonReels,
        reasonRadar,
      };

      return access;
    },
  });

  if (!data) {
    return { ...DEFAULT_ACCESS, isLoading };
  }

  return { ...data, isLoading };
}
