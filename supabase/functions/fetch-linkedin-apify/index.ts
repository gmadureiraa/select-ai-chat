import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function detectLinkedInTarget(input: string): { url: string; type: "person" | "company" } {
  const cleaned = input.trim();
  let url = cleaned;
  if (!/^https?:\/\//i.test(cleaned)) {
    // Bare handle → assume person
    url = `https://www.linkedin.com/in/${cleaned.replace(/^@/, "")}`;
  }
  const type: "person" | "company" = /linkedin\.com\/(company|school)\//i.test(url) ? "company" : "person";
  return { url, type };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const { clientId, handle } = await req.json();
    if (!clientId || !handle) throw new Error("clientId and handle are required");

    const apifyApiKey = Deno.env.get("APIFY_API_KEY") || Deno.env.get("APIFY_API_TOKEN");
    if (!apifyApiKey) throw new Error("APIFY_API_KEY not configured");

    const { url, type } = detectLinkedInTarget(handle);
    console.log(`[linkedin] Fetching ${type}: ${url}`);

    // Use harvestapi linkedin-profile-scraper for persons; for companies use apimaestro company scraper
    const actorId = type === "company"
      ? "apimaestro~linkedin-company-detail"
      : "harvestapi~linkedin-profile-scraper";

    const input: Record<string, unknown> = type === "company"
      ? { companyUrls: [url] }
      : { profileUrls: [url], maxItems: 1 };

    const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyApiKey}&timeout=120`;

    const apifyResponse = await fetch(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error("[linkedin] Apify error:", errorText);
      if (apifyResponse.status === 429 || apifyResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Apify rate limit / payment required", retryable: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Apify request failed: ${apifyResponse.status}`);
    }

    const items = await apifyResponse.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No data returned from Apify LinkedIn scraper");
    }

    const data = items[0];
    const followers = data.followersCount || data.followers || data.connectionsCount || 0;
    const headline = data.headline || data.tagline || data.description;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("platform_metrics").upsert({
      client_id: clientId,
      platform: "linkedin",
      metric_date: today,
      subscribers: followers,
      total_posts: data.postsCount || null,
      metadata: {
        target_type: type,
        url,
        headline,
        name: data.fullName || data.name,
        verified: data.verified || false,
        fetched_at: new Date().toISOString(),
        raw_keys: Object.keys(data).slice(0, 30),
      },
    }, { onConflict: "client_id,platform,metric_date" });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      duration_ms: Date.now() - startedAt,
      items_synced: 1,
      estimated_cost_usd: 0.02,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[linkedin] error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message, duration_ms: Date.now() - startedAt }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
