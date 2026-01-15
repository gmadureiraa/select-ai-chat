import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan configuration with Stripe price IDs (USD)
const PLANS = {
  basic: {
    priceId: "price_1SpuAmPIJtcImSMvb7h2pxYa", // $19.90/mês
    productId: "prod_TnVBYALwIy8qOm",
  },
  canvas: {
    priceId: "price_1SpuAmPIJtcImSMvb7h2pxYa", // $19.90/mês
    productId: "prod_TnVBYALwIy8qOm",
  },
  agency: {
    priceId: "price_1SpuAoPIJtcImSMvLMPO5XUo", // $99.90/mês
    productId: "prod_TnVBIbisvWihL7",
  },
  pro: {
    priceId: "price_1SpuAoPIJtcImSMvLMPO5XUo", // $99.90/mês
    productId: "prod_TnVBIbisvWihL7",
  },
  // Legacy support
  starter: {
    priceId: "price_1SpuAmPIJtcImSMvb7h2pxYa",
    productId: "prod_TnVBYALwIy8qOm",
  },
};

// Add-ons for Pro plan
const ADDONS = {
  extraClient: "price_1SpuApPIJtcImSMv7N5e3wE0", // $7/mês
  extraMember: "price_1SpuArPIJtcImSMvbzkPhebf", // $4/mês
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { planType, isNewWorkspace, workspaceName, workspaceSlug, currentSlug } = await req.json();
    logStep("Received request", { planType, isNewWorkspace, workspaceName, workspaceSlug, currentSlug });

    if (!planType || !PLANS[planType as keyof typeof PLANS]) {
      throw new Error(`Invalid plan type: ${planType}. Must be 'basic', 'agency', 'starter', or 'pro'`);
    }

    const plan = PLANS[planType as keyof typeof PLANS];

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://tkbsjtgrumhvwlxkmojg.lovableproject.com";

    // Determine success URL based on context
    let successUrl: string;
    if (isNewWorkspace) {
      successUrl = `${origin}/create-workspace-callback?session_id={CHECKOUT_SESSION_ID}`;
    } else if (currentSlug) {
      successUrl = `${origin}/${currentSlug}?checkout=success&plan=${planType}`;
    } else {
      successUrl = `${origin}/app?checkout=success&plan=${planType}`;
    }

    // Create checkout session (no trial)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_type: planType,
        },
      },
      success_url: successUrl,
      cancel_url: `${origin}/?checkout=canceled`,
      metadata: {
        user_id: user.id,
        plan_type: planType,
        is_new_workspace: isNewWorkspace ? "true" : "false",
        workspace_name: workspaceName || "",
        workspace_slug: workspaceSlug || "",
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
