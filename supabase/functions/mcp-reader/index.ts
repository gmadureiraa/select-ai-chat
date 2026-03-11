import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ============ MCP Server Setup ============

const mcpServer = new McpServer({
  name: "kaleidos-mcp",
  version: "1.0.0",
});

// ---------- READ TOOLS ----------

mcpServer.tool({
  name: "list_tables",
  description: "List all available database tables with row counts",
  inputSchema: { type: "object", properties: {}, required: [] },
  handler: async () => {
    const tables = [
      "clients", "planning_items", "planning_automations", "automations", "automation_runs",
      "scheduled_posts", "twitter_posts", "linkedin_posts", "instagram_posts", "instagram_stories",
      "youtube_videos", "platform_metrics", "client_content_library", "client_reference_library",
      "client_visual_references", "client_social_credentials", "client_documents", "client_websites",
      "global_knowledge", "conversations", "messages", "kai_chat_conversations", "kai_chat_messages",
      "kanban_columns", "kanban_cards", "format_rules", "content_canvas", "content_feedback",
      "engagement_opportunities", "notifications", "workspace_members", "workspaces",
      "workspace_subscriptions", "workspace_tokens", "ai_usage_logs", "profiles",
    ];
    const sb = getAdminClient();
    const results: { table: string; count: number | null }[] = [];
    for (const t of tables) {
      const { count } = await sb.from(t).select("*", { count: "exact", head: true });
      results.push({ table: t, count });
    }
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  },
});

mcpServer.tool({
  name: "query_table",
  description: "Query any table with optional filters, ordering, and pagination. Supports read-only SELECT queries.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name" },
      select: { type: "string", description: "Columns to select (default: *)" },
      filters: {
        type: "array",
        description: "Array of filter objects: {column, operator, value}. Operators: eq, neq, gt, gte, lt, lte, like, ilike, is, in",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            operator: { type: "string" },
            value: {},
          },
        },
      },
      order: { type: "string", description: "Column to order by" },
      ascending: { type: "boolean", description: "Sort ascending (default: false)" },
      limit: { type: "number", description: "Max rows (default: 100, max: 1000)" },
      offset: { type: "number", description: "Offset for pagination" },
    },
    required: ["table"],
  },
  handler: async ({ table, select, filters, order, ascending, limit, offset }: any) => {
    const sb = getAdminClient();
    let query = sb.from(table).select(select || "*", { count: "exact" });
    if (filters) {
      for (const f of filters) {
        (query as any) = query.filter(f.column, f.operator || "eq", f.value);
      }
    }
    if (order) query = query.order(order, { ascending: ascending ?? false });
    query = query.limit(Math.min(limit || 100, 1000));
    if (offset) query = query.range(offset, offset + (limit || 100) - 1);
    const { data, error, count } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ count, rows: data?.length, data }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_client",
  description: "Get full client profile with all related data (social credentials, websites, documents, voice profile, guidelines)",
  inputSchema: {
    type: "object",
    properties: {
      client_id: { type: "string", description: "Client UUID" },
    },
    required: ["client_id"],
  },
  handler: async ({ client_id }: any) => {
    const sb = getAdminClient();
    const [client, creds, websites, docs, visuals] = await Promise.all([
      sb.from("clients").select("*").eq("id", client_id).single(),
      sb.from("client_social_credentials").select("platform, account_name, account_id, is_valid, expires_at").eq("client_id", client_id),
      sb.from("client_websites").select("*").eq("client_id", client_id),
      sb.from("client_documents").select("id, name, file_type, created_at").eq("client_id", client_id),
      sb.from("client_visual_references").select("*").eq("client_id", client_id),
    ]);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          profile: client.data,
          social_credentials: creds.data,
          websites: websites.data,
          documents: docs.data,
          visual_references: visuals.data,
        }, null, 2),
      }],
    };
  },
});

mcpServer.tool({
  name: "get_content_library",
  description: "Get content library items for a client",
  inputSchema: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      limit: { type: "number" },
    },
    required: ["client_id"],
  },
  handler: async ({ client_id, limit }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("client_content_library").select("*").eq("client_id", client_id).order("created_at", { ascending: false }).limit(limit || 50);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_references",
  description: "Get reference library items for a client",
  inputSchema: {
    type: "object",
    properties: { client_id: { type: "string" }, limit: { type: "number" } },
    required: ["client_id"],
  },
  handler: async ({ client_id, limit }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("client_reference_library").select("*").eq("client_id", client_id).order("created_at", { ascending: false }).limit(limit || 50);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_metrics",
  description: "Get platform metrics and social posts for a client (twitter, linkedin, instagram, youtube)",
  inputSchema: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      platform: { type: "string", description: "Filter by platform: twitter, linkedin, instagram, youtube, all (default: all)" },
      limit: { type: "number" },
    },
    required: ["client_id"],
  },
  handler: async ({ client_id, platform, limit }: any) => {
    const sb = getAdminClient();
    const lim = limit || 50;
    const result: Record<string, any> = {};
    const p = platform || "all";

    const queries: Promise<void>[] = [];
    if (p === "all" || p === "twitter") {
      queries.push(sb.from("twitter_posts").select("*").eq("client_id", client_id).order("posted_at", { ascending: false }).limit(lim).then(r => { result.twitter = r.data; }));
    }
    if (p === "all" || p === "linkedin") {
      queries.push(sb.from("linkedin_posts").select("*").eq("client_id", client_id).order("posted_at", { ascending: false }).limit(lim).then(r => { result.linkedin = r.data; }));
    }
    if (p === "all" || p === "instagram") {
      queries.push(sb.from("instagram_posts").select("*").eq("client_id", client_id).order("posted_at", { ascending: false }).limit(lim).then(r => { result.instagram = r.data; }));
    }
    if (p === "all" || p === "youtube") {
      queries.push(sb.from("youtube_videos").select("*").eq("client_id", client_id).order("published_at", { ascending: false }).limit(lim).then(r => { result.youtube = r.data; }));
    }
    queries.push(sb.from("platform_metrics").select("*").eq("client_id", client_id).order("metric_date", { ascending: false }).limit(lim).then(r => { result.platform_metrics = r.data; }));

    await Promise.all(queries);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

mcpServer.tool({
  name: "get_automations",
  description: "Get all automations and planning automations for a client, including recent runs",
  inputSchema: {
    type: "object",
    properties: { client_id: { type: "string" } },
    required: ["client_id"],
  },
  handler: async ({ client_id }: any) => {
    const sb = getAdminClient();
    const [automations, planningAutos, runs] = await Promise.all([
      sb.from("automations").select("*").eq("client_id", client_id),
      sb.from("planning_automations").select("*").eq("client_id", client_id),
      sb.from("automation_runs").select("*").order("started_at", { ascending: false }).limit(20),
    ]);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          automations: automations.data,
          planning_automations: planningAutos.data,
          recent_runs: runs.data,
        }, null, 2),
      }],
    };
  },
});

mcpServer.tool({
  name: "get_planning",
  description: "Get planning items (kanban cards, scheduled posts) for a client or workspace",
  inputSchema: {
    type: "object",
    properties: {
      client_id: { type: "string", description: "Client UUID (optional)" },
      workspace_id: { type: "string", description: "Workspace UUID (optional)" },
      status: { type: "string", description: "Filter by status" },
      limit: { type: "number" },
    },
  },
  handler: async ({ client_id, workspace_id, status, limit }: any) => {
    const sb = getAdminClient();
    const lim = limit || 100;
    const result: Record<string, any> = {};

    // Planning items
    let piQuery = sb.from("planning_items").select("*").order("scheduled_at", { ascending: false }).limit(lim);
    if (client_id) piQuery = piQuery.eq("client_id", client_id);
    if (workspace_id) piQuery = piQuery.eq("workspace_id", workspace_id);
    if (status) piQuery = piQuery.eq("status", status);
    const { data: items } = await piQuery;
    result.planning_items = items;

    // Scheduled posts
    let spQuery = sb.from("scheduled_posts").select("*").order("scheduled_at", { ascending: false }).limit(lim);
    if (client_id) spQuery = spQuery.eq("client_id", client_id);
    const { data: scheduled } = await spQuery;
    result.scheduled_posts = scheduled;

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

mcpServer.tool({
  name: "search_knowledge",
  description: "Search the global knowledge base by keyword or text",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      workspace_id: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  },
  handler: async ({ query, workspace_id, limit }: any) => {
    const sb = getAdminClient();
    let q = sb.from("global_knowledge").select("id, title, summary, category, tags, source_url, created_at").ilike("title", `%${query}%`).limit(limit || 20);
    if (workspace_id) q = q.eq("workspace_id", workspace_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
});

// ---------- WRITE TOOLS ----------

mcpServer.tool({
  name: "create_planning_item",
  description: "Create a new planning item (content card) for a client",
  inputSchema: {
    type: "object",
    properties: {
      client_id: { type: "string" },
      workspace_id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      platform: { type: "string", description: "twitter, linkedin, instagram, threads, etc." },
      content_type: { type: "string" },
      status: { type: "string", description: "idea, draft, review, approved, scheduled, published" },
      scheduled_at: { type: "string", description: "ISO datetime" },
      content: { type: "string", description: "The actual post content" },
      image_url: { type: "string" },
    },
    required: ["client_id", "workspace_id", "title"],
  },
  handler: async (params: any) => {
    const sb = getAdminClient();
    // Get first column for workspace
    const { data: cols } = await sb.from("kanban_columns").select("id").eq("workspace_id", params.workspace_id).order("position").limit(1);
    const columnId = cols?.[0]?.id;

    const { data, error } = await sb.from("planning_items").insert({
      client_id: params.client_id,
      workspace_id: params.workspace_id,
      title: params.title,
      description: params.description || null,
      platform: params.platform || null,
      content_type: params.content_type || null,
      status: params.status || "idea",
      scheduled_at: params.scheduled_at || null,
      content: params.content || null,
      image_url: params.image_url || null,
      column_id: columnId,
    }).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ success: true, item: data }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "update_planning_item",
  description: "Update an existing planning item",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Planning item UUID" },
      title: { type: "string" },
      description: { type: "string" },
      content: { type: "string" },
      status: { type: "string" },
      platform: { type: "string" },
      scheduled_at: { type: "string" },
      image_url: { type: "string" },
    },
    required: ["id"],
  },
  handler: async ({ id, ...updates }: any) => {
    const sb = getAdminClient();
    // Remove undefined values
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }
    const { data, error } = await sb.from("planning_items").update(cleanUpdates).eq("id", id).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ success: true, item: data }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "update_automation",
  description: "Update a planning automation (prompt, schedule, config, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Automation UUID" },
      updates: { type: "object", description: "Fields to update (any columns from planning_automations)" },
    },
    required: ["id", "updates"],
  },
  handler: async ({ id, updates }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("planning_automations").update(updates).eq("id", id).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ success: true, automation: data }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "insert_row",
  description: "Insert a row into any table. Use with caution.",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name" },
      row: { type: "object", description: "Row data as key-value pairs" },
    },
    required: ["table", "row"],
  },
  handler: async ({ table, row }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ success: true, data }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "update_row",
  description: "Update rows in any table by ID",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      id: { type: "string", description: "Row UUID" },
      updates: { type: "object", description: "Fields to update" },
    },
    required: ["table", "id", "updates"],
  },
  handler: async ({ table, id, updates }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from(table).update(updates).eq("id", id).select().single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ success: true, data }, null, 2) }] };
  },
});

mcpServer.tool({
  name: "delete_row",
  description: "Delete a row from any table by ID",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      id: { type: "string" },
    },
    required: ["table", "id"],
  },
  handler: async ({ table, id }: any) => {
    const sb = getAdminClient();
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify({ success: true, deleted: id }) }] };
  },
});

mcpServer.tool({
  name: "invoke_function",
  description: "Invoke any Supabase edge function (e.g. generate content, process automations, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      function_name: { type: "string", description: "Edge function name (e.g. 'unified-content-api', 'process-automations')" },
      body: { type: "object", description: "Request body to send" },
    },
    required: ["function_name"],
  },
  handler: async ({ function_name, body }: any) => {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/${function_name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body || {}),
      });
      const text = await resp.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { content: [{ type: "text", text: JSON.stringify({ status: resp.status, data: parsed }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }] };
    }
  },
});

mcpServer.tool({
  name: "get_schema",
  description: "Get the column names and types for a specific table",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name" },
    },
    required: ["table"],
  },
  handler: async ({ table }: any) => {
    const sb = getAdminClient();
    // Fetch one row to infer schema
    const { data, error } = await sb.from(table).select("*").limit(1);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: `Table "${table}" exists but has no rows to infer schema from.` }] };
    }
    const columns = Object.entries(data[0]).map(([key, value]) => ({
      column: key,
      type: value === null ? "unknown" : typeof value,
      sample: typeof value === "object" ? JSON.stringify(value)?.slice(0, 100) : String(value)?.slice(0, 100),
    }));
    return { content: [{ type: "text", text: JSON.stringify(columns, null, 2) }] };
  },
});

// ============ HTTP Transport ============

const app = new Hono();
const transport = new StreamableHttpTransport();

// Auth middleware - validate service role key or anon key
app.use("/*", async (c, next) => {
  const authHeader = c.req.header("Authorization") || "";
  const apiKey = c.req.header("apikey") || "";
  const token = authHeader.replace("Bearer ", "");

  // Accept service role key or anon key
  if (token !== SUPABASE_SERVICE_ROLE_KEY && token !== SUPABASE_ANON_KEY && apiKey !== SUPABASE_SERVICE_ROLE_KEY && apiKey !== SUPABASE_ANON_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

app.all("/*", async (c) => {
  return await transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
