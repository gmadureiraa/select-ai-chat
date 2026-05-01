import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = "instagram" | "tiktok" | "twitter" | "linkedin" | "youtube";

interface PlatformJob {
  platform: Platform;
  fnName: string;
  body: Record<string, unknown>;
  estimated_cost_usd: number;
}

function extractHandle(value: string | undefined | null, kind: Platform): string | null {
  if (!value || typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  // Strip URL prefix → take last path segment
  const urlMatch = v.match(/[a-z]+\.com\/(?:@)?([^/?#]+)/i);
  let h = urlMatch ? urlMatch[1] : v.replace(/^@/, "").replace(/^https?:\/\//i, "");
  h = h.replace(/^@/, "").trim();
  if (kind === "linkedin") return v; // keep full url/handle, fn handles it
  return h || null;
}

function buildJobsForClient(client: any, platforms: Platform[]): PlatformJob[] {
  const sm = client.social_media || {};
  const jobs: PlatformJob[] = [];

  if (platforms.includes("instagram")) {
    const ig = extractHandle(sm.instagram, "instagram");
    if (ig) jobs.push({
      platform: "instagram",
      fnName: "fetch-instagram-metrics",
      body: { clientId: client.id, username: ig },
      estimated_cost_usd: 0.03,
    });
  }
  if (platforms.includes("tiktok")) {
    const tt = extractHandle(sm.tiktok, "tiktok");
    if (tt) jobs.push({
      platform: "tiktok",
      fnName: "fetch-tiktok-apify",
      body: { clientId: client.id, username: tt },
      estimated_cost_usd: 0.01,
    });
  }
  if (platforms.includes("twitter")) {
    const tw = extractHandle(sm.twitter, "twitter");
    if (tw) jobs.push({
      platform: "twitter",
      fnName: "fetch-twitter-apify",
      body: { clientId: client.id, username: tw },
      estimated_cost_usd: 0.01,
    });
  }
  if (platforms.includes("linkedin")) {
    const li = sm.linkedin;
    if (li && typeof li === "string" && li.trim()) jobs.push({
      platform: "linkedin",
      fnName: "fetch-linkedin-apify",
      body: { clientId: client.id, handle: li.trim() },
      estimated_cost_usd: 0.02,
    });
  }
  if (platforms.includes("youtube")) {
    const yt = sm.youtube_channel_id || extractHandle(sm.youtube, "youtube");
    if (yt) jobs.push({
      platform: "youtube",
      fnName: "fetch-youtube-metrics", // official Google API → free
      body: { clientId: client.id, channelHandle: yt },
      estimated_cost_usd: 0,
    });
  }
  return jobs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const platforms: Platform[] = Array.isArray(body.platforms) && body.platforms.length
      ? body.platforms
      : ["instagram", "tiktok", "twitter", "linkedin", "youtube"];
    const triggeredBy = body.source === "cron" ? "cron" : "manual";
    const onlyClientId = body.clientId as string | undefined;

    let query = supabase.from("clients").select("id, name, social_media");
    if (onlyClientId) query = query.eq("id", onlyClientId);
    const { data: clients, error } = await query;
    if (error) throw error;

    const allJobs: Array<{ client: any; job: PlatformJob }> = [];
    for (const c of clients || []) {
      const jobs = buildJobsForClient(c, platforms);
      for (const j of jobs) allJobs.push({ client: c, job: j });
    }

    console.log(`[sync-all-metrics] ${clients?.length} clients → ${allJobs.length} jobs (${platforms.join(",")})`);

    // Execute in parallel with concurrency cap (5 at a time)
    const CONCURRENCY = 5;
    const results: any[] = [];
    let totalCost = 0;
    for (let i = 0; i < allJobs.length; i += CONCURRENCY) {
      const batch = allJobs.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(batch.map(async ({ client, job }) => {
        const t0 = Date.now();
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/${job.fnName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify(job.body),
          });
          const json = await res.json().catch(() => ({}));
          const ok = res.ok && json?.success !== false;
          const duration = Date.now() - t0;
          totalCost += job.estimated_cost_usd;

          await supabase.from("metrics_sync_runs").insert({
            client_id: client.id,
            platform: job.platform,
            status: ok ? "success" : "failed",
            triggered_by: triggeredBy,
            duration_ms: duration,
            estimated_cost_usd: job.estimated_cost_usd,
            items_synced: json?.items_synced || 0,
            error_message: ok ? null : (json?.error || `HTTP ${res.status}`),
            metadata: { client_name: client.name },
          });
          return { client: client.name, platform: job.platform, ok, error: ok ? null : json?.error };
        } catch (e: any) {
          const duration = Date.now() - t0;
          await supabase.from("metrics_sync_runs").insert({
            client_id: client.id,
            platform: job.platform,
            status: "failed",
            triggered_by: triggeredBy,
            duration_ms: duration,
            estimated_cost_usd: 0,
            error_message: e.message,
            metadata: { client_name: client.name },
          });
          return { client: client.name, platform: job.platform, ok: false, error: e.message };
        }
      }));
      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value);
        else results.push({ ok: false, error: String(r.reason) });
      }
    }

    const ok = results.filter(r => r.ok).length;
    const failed = results.length - ok;

    return new Response(JSON.stringify({
      success: true,
      duration_ms: Date.now() - startedAt,
      total_jobs: results.length,
      ok, failed,
      estimated_cost_usd: Number(totalCost.toFixed(4)),
      triggered_by: triggeredBy,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[sync-all-metrics] fatal:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
