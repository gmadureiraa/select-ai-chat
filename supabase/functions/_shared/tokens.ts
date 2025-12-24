import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TokenCheckResult {
  hasTokens: boolean;
  balance: number;
  isUnlimited: boolean;
  planType?: string;
  error?: string;
}

export interface TokenDebitResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

// Token costs per operation
export const TOKEN_COSTS = {
  chat_simple: 1,      // Basic chat message
  chat_long: 3,        // Long chat (>1500 chars output)
  image_generation: 10,
  document_analysis: 5,
  knowledge_processing: 5,
  style_analysis: 5,
  performance_insights: 3,
  research_analysis: 5,
  youtube_sentiment: 3,
  branding_extraction: 5,
};

export function createSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Check if workspace has enough tokens
 */
export async function checkWorkspaceTokens(
  workspaceId: string,
  requiredAmount: number = 1
): Promise<TokenCheckResult> {
  try {
    const supabase = createSupabaseAdmin();

    // First check if workspace has unlimited tokens (enterprise plan)
    const { data: subscription, error: subError } = await supabase
      .from("workspace_subscriptions")
      .select(`
        subscription_plans (
          type
        )
      `)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .single();

    if (subError) {
      console.error("[TOKENS] Error checking subscription:", subError);
    }

    const planType = (subscription?.subscription_plans as any)?.type;
    
    // Enterprise plans have unlimited tokens
    if (planType === "enterprise") {
      console.log(`[TOKENS] Workspace ${workspaceId} has unlimited tokens (enterprise)`);
      return {
        hasTokens: true,
        balance: 999999999,
        isUnlimited: true,
        planType,
      };
    }

    // Check token balance
    const { data: tokens, error: tokenError } = await supabase
      .from("workspace_tokens")
      .select("balance")
      .eq("workspace_id", workspaceId)
      .single();

    if (tokenError) {
      console.error("[TOKENS] Error checking balance:", tokenError);
      return {
        hasTokens: false,
        balance: 0,
        isUnlimited: false,
        error: "Could not check token balance",
      };
    }

    const balance = tokens?.balance || 0;
    const hasTokens = balance >= requiredAmount;

    console.log(`[TOKENS] Workspace ${workspaceId}: balance=${balance}, required=${requiredAmount}, hasTokens=${hasTokens}`);

    return {
      hasTokens,
      balance,
      isUnlimited: false,
      planType,
    };
  } catch (error) {
    console.error("[TOKENS] Unexpected error:", error);
    return {
      hasTokens: false,
      balance: 0,
      isUnlimited: false,
      error: String(error),
    };
  }
}

/**
 * Debit tokens from workspace
 */
export async function debitWorkspaceTokens(
  workspaceId: string,
  userId: string | null,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<TokenDebitResult> {
  try {
    const supabase = createSupabaseAdmin();

    // First check if unlimited
    const checkResult = await checkWorkspaceTokens(workspaceId, amount);
    
    if (checkResult.isUnlimited) {
      console.log(`[TOKENS] Skipping debit for unlimited workspace ${workspaceId}`);
      return {
        success: true,
        newBalance: 999999999,
      };
    }

    if (!checkResult.hasTokens) {
      console.warn(`[TOKENS] Insufficient tokens for workspace ${workspaceId}`);
      return {
        success: false,
        newBalance: checkResult.balance,
        error: "Insufficient tokens",
      };
    }

    // Use the database function to debit tokens
    const { data, error } = await supabase.rpc("debit_workspace_tokens", {
      p_workspace_id: workspaceId,
      p_amount: amount,
      p_user_id: userId,
      p_description: description,
      p_metadata: metadata,
    });

    if (error) {
      console.error("[TOKENS] Error debiting:", error);
      return {
        success: false,
        newBalance: checkResult.balance,
        error: error.message,
      };
    }

    const result = data?.[0];
    
    if (!result?.success) {
      console.warn("[TOKENS] Debit failed:", result?.error);
      return {
        success: false,
        newBalance: result?.new_balance || 0,
        error: result?.error || "Unknown error",
      };
    }

    console.log(`[TOKENS] Debited ${amount} from workspace ${workspaceId}, new balance: ${result.new_balance}`);
    
    return {
      success: true,
      newBalance: result.new_balance,
    };
  } catch (error) {
    console.error("[TOKENS] Unexpected error:", error);
    return {
      success: false,
      newBalance: 0,
      error: String(error),
    };
  }
}

/**
 * Create insufficient tokens error response
 */
export function createInsufficientTokensResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "insufficient_tokens",
      message: "Tokens insuficientes. Faça upgrade do seu plano para continuar.",
      code: "TOKENS_EXHAUSTED",
    }),
    {
      status: 402, // Payment Required
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Get workspace ID from user ID
 */
export async function getWorkspaceIdFromUser(userId: string): Promise<string | null> {
  try {
    const supabase = createSupabaseAdmin();
    
    const { data, error } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (error || !data) {
      console.error("[TOKENS] Could not find workspace for user:", error);
      return null;
    }

    return data.workspace_id;
  } catch (error) {
    console.error("[TOKENS] Error getting workspace:", error);
    return null;
  }
}
