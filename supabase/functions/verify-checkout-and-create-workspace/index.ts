import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");
    logStep("Received session ID", { sessionId });

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    logStep("Retrieved checkout session", { 
      sessionId: session.id, 
      paymentStatus: session.payment_status,
      status: session.status 
    });

    // Verify payment was successful
    if (session.status !== "complete") {
      throw new Error("Payment not completed");
    }

    // Get metadata
    const metadata = session.metadata || {};
    const isNewWorkspace = metadata.is_new_workspace === "true";
    const workspaceName = metadata.workspace_name;
    const workspaceSlug = metadata.workspace_slug;
    const planType = metadata.plan_type;
    logStep("Extracted metadata", { isNewWorkspace, workspaceName, workspaceSlug, planType });

    if (!isNewWorkspace) {
      throw new Error("This endpoint is only for new workspace creation");
    }

    if (!workspaceName || !workspaceSlug || !planType) {
      throw new Error("Missing required metadata for workspace creation");
    }

    // Get subscription info
    const subscription = session.subscription as Stripe.Subscription | null;
    const stripeSubscriptionId = subscription?.id || null;
    const stripeCustomerId = session.customer as string;
    logStep("Stripe info", { stripeSubscriptionId, stripeCustomerId });

    // Create the workspace with paid subscription
    const { data: workspaceId, error: createError } = await supabaseClient.rpc(
      "create_workspace_with_paid_subscription",
      {
        p_name: workspaceName,
        p_slug: workspaceSlug,
        p_owner_id: user.id,
        p_plan_type: planType,
        p_stripe_subscription_id: stripeSubscriptionId,
        p_stripe_customer_id: stripeCustomerId,
      }
    );

    if (createError) {
      logStep("Error creating workspace", { error: createError.message });
      throw new Error(`Failed to create workspace: ${createError.message}`);
    }

    logStep("Workspace created successfully", { workspaceId, slug: workspaceSlug });

    return new Response(
      JSON.stringify({ 
        success: true, 
        workspaceId, 
        slug: workspaceSlug 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
