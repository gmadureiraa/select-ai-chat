/**
 * profile-bridge — ponte entre o KAI (Neon Auth + workspace_subscriptions)
 * e o shape do `profile` que o standalone Sequencia Viral espera.
 *
 * O standalone tinha campos no `profiles`:
 *   - usage_count, usage_limit
 *   - plan ('free'|'pro'|'business')
 *   - period_start
 *   - referral_code, referred_by
 *
 * Apos migration 0008, todos esses campos existem em `public.profiles`
 * (com `sv_plan`/`sv_period_start` namespaced). Esse hook le profile +
 * subscription do workspace e devolve um objeto compativel com
 * `UserProfile` do `auth-context.tsx`.
 *
 * Observacoes:
 *   - Mapeia `subscription_plans.type` → `plan` legacy:
 *     'free' → 'free' / 'starter' → 'free' (limite ainda baixo)
 *     'pro' → 'pro' (Creator no SV) / 'enterprise' → 'business' (Pro no SV)
 *   - `usage_count` vem direto de `profiles.usage_count` (atualizado via
 *     RPC `increment_sv_usage`).
 *   - `usage_limit` mapeado pelo plano da subscription, nao da coluna
 *     `profiles.usage_limit` (que fica como fallback).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SvLegacyPlan = "free" | "pro" | "business";

export interface SvProfileShape {
  id: string | undefined;
  email: string | undefined;
  full_name?: string | null;
  avatar_url?: string | null;
  usage_count: number;
  usage_limit: number;
  /** Mapeado do KAI subscription pra namespace legacy do SV. */
  plan: SvLegacyPlan;
  period_start: string | undefined;
  referral_code: string | null;
  referred_by: string | null;
  /** Plano cru do KAI (free/starter/pro/enterprise) — pra debugging. */
  sv_plan?: string | null;
  /** Quando true, profile ainda esta carregando — fallback pra valores 0/5/free. */
  loading: boolean;
}

interface RawProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  usage_count: number | null;
  usage_limit: number | null;
  sv_plan: string | null;
  sv_period_start: string | null;
  referral_code: string | null;
  referred_by: string | null;
}

interface RawSubscriptionRow {
  status: string;
  current_period_start: string;
  subscription_plans: {
    type: "free" | "starter" | "pro" | "enterprise";
    tokens_monthly: number;
  } | null;
}

/**
 * Limites mensais de carrosseis SV por plano KAI.
 * Free/Starter sao tratados como 'free' do SV (5 carrosseis/mes).
 * Pro KAI = Creator SV (30 carrosseis). Enterprise = ilimitado.
 */
function planQuotas(planType: string | undefined | null): {
  legacyPlan: SvLegacyPlan;
  usageLimit: number;
} {
  switch (planType) {
    case "pro":
      return { legacyPlan: "pro", usageLimit: 30 };
    case "enterprise":
      return { legacyPlan: "business", usageLimit: 9999 };
    case "starter":
    case "free":
    default:
      return { legacyPlan: "free", usageLimit: 5 };
  }
}

/**
 * Retorna o profile do SV no shape esperado pelas pages de viral-sv-original/.
 *
 * Fallback gracioso: se o user nao tem profile (ainda nao logou) ou se a
 * subscription nao existe (workspace recem-criado), volta defaults free.
 */
export function useSvProfile(): SvProfileShape {
  const { user } = useAuth();
  const userId = user?.id;

  // 1. Profile bruto + workspace_id via inner join em workspace_members.
  const { data: profile, isLoading: profileLoading } = useQuery<{
    profile: RawProfile;
    workspaceId: string | null;
  } | null>({
    queryKey: ["sv-profile-bridge", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, avatar_url, usage_count, usage_limit, sv_plan, sv_period_start, referral_code, referred_by",
        )
        .eq("id", userId)
        .maybeSingle();
      if (profErr) {
        console.warn("[useSvProfile] profiles fetch failed:", profErr.message);
        return null;
      }
      // Pega workspace_id do user (primeira membership). Pra usuarios com
      // multiplos workspaces, um Switcher futuro decide qual usar — aqui
      // tomamos o mais antigo.
      const { data: memb } = await supabase
        .from("workspace_members")
        .select("workspace_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        profile: (prof as unknown as RawProfile | null) ?? {
          id: userId,
          email: user?.email ?? null,
          full_name: null,
          avatar_url: null,
          usage_count: 0,
          usage_limit: 5,
          sv_plan: "free",
          sv_period_start: null,
          referral_code: null,
          referred_by: null,
        },
        workspaceId: (memb?.workspace_id as string | undefined) ?? null,
      };
    },
  });

  // 2. Subscription do workspace (se houver). Determina plano efetivo.
  const workspaceId = profile?.workspaceId ?? null;
  const { data: subscription } = useQuery<RawSubscriptionRow | null>({
    queryKey: ["sv-profile-bridge-sub", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from("workspace_subscriptions")
        .select("status, current_period_start, subscription_plans(type, tokens_monthly)")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) {
        console.warn("[useSvProfile] subscription fetch failed:", error.message);
        return null;
      }
      return (data as unknown as RawSubscriptionRow | null) ?? null;
    },
  });

  return useMemo<SvProfileShape>(() => {
    const raw = profile?.profile;
    const planType = subscription?.subscription_plans?.type ?? raw?.sv_plan ?? "free";
    const { legacyPlan, usageLimit: planLimit } = planQuotas(planType);

    return {
      id: raw?.id,
      email: raw?.email ?? user?.email ?? undefined,
      full_name: raw?.full_name,
      avatar_url: raw?.avatar_url,
      usage_count: raw?.usage_count ?? 0,
      // Prefere valor da subscription, mas cai pra coluna profile.usage_limit
      // se ela tiver override manual (ex: Gabriel deu bonus a alguem).
      usage_limit: raw?.usage_limit && raw.usage_limit > planLimit ? raw.usage_limit : planLimit,
      plan: legacyPlan,
      period_start: subscription?.current_period_start ?? raw?.sv_period_start ?? undefined,
      referral_code: raw?.referral_code ?? null,
      referred_by: raw?.referred_by ?? null,
      sv_plan: raw?.sv_plan ?? null,
      loading: profileLoading,
    };
  }, [profile, subscription, profileLoading, user?.email]);
}
