import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_ACCESS_TOKEN = Deno.env.get("MCP_ACCESS_TOKEN")!;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ============ MCP Server Setup ============

const mcpServer = new McpServer({
  name: "kaleidos-mcp",
  version: "1.0.0",
  schemaAdapter: (schema: any) => schema,
});

// ---------- READ TOOLS ----------

mcpServer.tool("list_tables", {
  description: "List all available database tables with row counts",
  inputSchema: { type: "object" as const, properties: {}, required: [] },
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
    return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
  },
});

mcpServer.tool("query_table", {
  description: "Query any table with optional filters, ordering, and pagination. Supports read-only SELECT queries.",
  inputSchema: {
    type: "object" as const,
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
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count, rows: data?.length, data }, null, 2) }] };
  },
});

mcpServer.tool("get_client", {
  description: "Get full client profile with all related data (social credentials, websites, documents, voice profile, guidelines)",
  inputSchema: {
    type: "object" as const,
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
        type: "text" as const,
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

mcpServer.tool("get_content_library", {
  description: "Get content library items for a client",
  inputSchema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string" },
      limit: { type: "number" },
    },
    required: ["client_id"],
  },
  handler: async ({ client_id, limit }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("client_content_library").select("*").eq("client_id", client_id).order("created_at", { ascending: false }).limit(limit || 50);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_references", {
  description: "Get reference library items for a client",
  inputSchema: {
    type: "object" as const,
    properties: { client_id: { type: "string" }, limit: { type: "number" } },
    required: ["client_id"],
  },
  handler: async ({ client_id, limit }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("client_reference_library").select("*").eq("client_id", client_id).order("created_at", { ascending: false }).limit(limit || 50);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_metrics", {
  description: "Get platform metrics and social posts for a client (twitter, linkedin, instagram, youtube)",
  inputSchema: {
    type: "object" as const,
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
      queries.push(Promise.resolve(sb.from("twitter_posts").select("*").eq("client_id", client_id).order("posted_at", { ascending: false }).limit(lim).then((r: any) => { result.twitter = r.data; })));
    }
    if (p === "all" || p === "linkedin") {
      queries.push(Promise.resolve(sb.from("linkedin_posts").select("*").eq("client_id", client_id).order("posted_at", { ascending: false }).limit(lim).then((r: any) => { result.linkedin = r.data; })));
    }
    if (p === "all" || p === "instagram") {
      queries.push(Promise.resolve(sb.from("instagram_posts").select("*").eq("client_id", client_id).order("posted_at", { ascending: false }).limit(lim).then((r: any) => { result.instagram = r.data; })));
    }
    if (p === "all" || p === "youtube") {
      queries.push(Promise.resolve(sb.from("youtube_videos").select("*").eq("client_id", client_id).order("published_at", { ascending: false }).limit(lim).then((r: any) => { result.youtube = r.data; })));
    }
    queries.push(Promise.resolve(sb.from("platform_metrics").select("*").eq("client_id", client_id).order("metric_date", { ascending: false }).limit(lim).then((r: any) => { result.platform_metrics = r.data; })));

    await Promise.all(queries);
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
});

mcpServer.tool("get_automations", {
  description: "Get all automations and planning automations for a client, including recent runs",
  inputSchema: {
    type: "object" as const,
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
        type: "text" as const,
        text: JSON.stringify({
          automations: automations.data,
          planning_automations: planningAutos.data,
          recent_runs: runs.data,
        }, null, 2),
      }],
    };
  },
});

mcpServer.tool("get_planning", {
  description: "Get planning items (kanban cards, scheduled posts) for a client or workspace",
  inputSchema: {
    type: "object" as const,
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

    let piQuery = sb.from("planning_items").select("*").order("scheduled_at", { ascending: false }).limit(lim);
    if (client_id) piQuery = piQuery.eq("client_id", client_id);
    if (workspace_id) piQuery = piQuery.eq("workspace_id", workspace_id);
    if (status) piQuery = piQuery.eq("status", status);
    const { data: items } = await piQuery;
    result.planning_items = items;

    let spQuery = sb.from("scheduled_posts").select("*").order("scheduled_at", { ascending: false }).limit(lim);
    if (client_id) spQuery = spQuery.eq("client_id", client_id);
    const { data: scheduled } = await spQuery;
    result.scheduled_posts = scheduled;

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  },
});

mcpServer.tool("search_knowledge", {
  description: "Search the global knowledge base by keyword or text",
  inputSchema: {
    type: "object" as const,
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
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcpServer.tool("get_schema", {
  description: "Get the column names and types for a specific table",
  inputSchema: {
    type: "object" as const,
    properties: {
      table: { type: "string", description: "Table name" },
    },
    required: ["table"],
  },
  handler: async ({ table }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from(table).select("*").limit(1);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    if (!data || data.length === 0) {
      return { content: [{ type: "text" as const, text: `Table "${table}" exists but has no rows to infer schema from.` }] };
    }
    const columns = Object.entries(data[0]).map(([key, value]) => ({
      column: key,
      type: value === null ? "unknown" : typeof value,
      sample: typeof value === "object" ? JSON.stringify(value)?.slice(0, 100) : String(value)?.slice(0, 100),
    }));
    return { content: [{ type: "text" as const, text: JSON.stringify(columns, null, 2) }] };
  },
});

// ---------- WRITE TOOLS ----------

mcpServer.tool("create_planning_item", {
  description: "Create a new planning item (content card) for a client",
  inputSchema: {
    type: "object" as const,
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
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, item: data }, null, 2) }] };
  },
});

mcpServer.tool("update_planning_item", {
  description: "Update an existing planning item",
  inputSchema: {
    type: "object" as const,
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
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }
    const { data, error } = await sb.from("planning_items").update(cleanUpdates).eq("id", id).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, item: data }, null, 2) }] };
  },
});

mcpServer.tool("update_automation", {
  description: "Update a planning automation (prompt, schedule, config, etc.)",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string", description: "Automation UUID" },
      updates: { type: "object", description: "Fields to update (any columns from planning_automations)" },
    },
    required: ["id", "updates"],
  },
  handler: async ({ id, updates }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("planning_automations").update(updates).eq("id", id).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, automation: data }, null, 2) }] };
  },
});

mcpServer.tool("insert_row", {
  description: "Insert a row into any table. Use with caution.",
  inputSchema: {
    type: "object" as const,
    properties: {
      table: { type: "string", description: "Table name" },
      row: { type: "object", description: "Row data as key-value pairs" },
    },
    required: ["table", "row"],
  },
  handler: async ({ table, row }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, data }, null, 2) }] };
  },
});

mcpServer.tool("update_row", {
  description: "Update rows in any table by ID",
  inputSchema: {
    type: "object" as const,
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
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, data }, null, 2) }] };
  },
});

mcpServer.tool("delete_row", {
  description: "Delete a row from any table by ID",
  inputSchema: {
    type: "object" as const,
    properties: {
      table: { type: "string" },
      id: { type: "string" },
    },
    required: ["table", "id"],
  },
  handler: async ({ table, id }: any) => {
    const sb = getAdminClient();
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted: id }) }] };
  },
});

mcpServer.tool("invoke_function", {
  description: "Invoke any Supabase edge function (e.g. generate content, process automations, etc.)",
  inputSchema: {
    type: "object" as const,
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
        },
        body: JSON.stringify(body || {}),
      });
      const text = await resp.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: resp.status, data: parsed }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  },
});

// ---------- STORAGE TOOLS ----------

mcpServer.tool("upload_file", {
  description: "Upload a file to storage via URL or base64. Returns permanent public URL.",
  inputSchema: {
    type: "object" as const,
    properties: {
      bucket: { type: "string", description: "Storage bucket name (e.g. client-files, chat-images)" },
      path: { type: "string", description: "File path inside the bucket (e.g. client-id/photo.jpg)" },
      file_url: { type: "string", description: "URL to download and upload (use this OR base64)" },
      base64: { type: "string", description: "Base64-encoded file content (use this OR file_url)" },
      content_type: { type: "string", description: "MIME type (e.g. image/png, video/mp4). Required for base64, auto-detected for URL." },
    },
    required: ["bucket", "path"],
  },
  handler: async ({ bucket, path, file_url, base64, content_type }: any) => {
    try {
      const sb = getAdminClient();
      let buffer: ArrayBuffer;
      let mime = content_type || "application/octet-stream";

      if (file_url) {
        const resp = await fetch(file_url);
        if (!resp.ok) return { content: [{ type: "text" as const, text: `Error: Failed to fetch URL (${resp.status})` }] };
        buffer = await resp.arrayBuffer();
        if (!content_type && resp.headers.get("content-type")) {
          mime = resp.headers.get("content-type")!.split(";")[0];
        }
      } else if (base64) {
        const raw = atob(base64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        buffer = arr.buffer;
      } else {
        return { content: [{ type: "text" as const, text: "Error: Provide either file_url or base64" }] };
      }

      const { error } = await sb.storage.from(bucket).upload(path, buffer, {
        contentType: mime,
        upsert: true,
      });
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, public_url: urlData.publicUrl, bucket, path, content_type: mime }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  },
});

mcpServer.tool("list_files", {
  description: "List files in a storage bucket/folder",
  inputSchema: {
    type: "object" as const,
    properties: {
      bucket: { type: "string" },
      folder: { type: "string", description: "Folder path (optional)" },
      limit: { type: "number", description: "Max files to return (default: 100)" },
    },
    required: ["bucket"],
  },
  handler: async ({ bucket, folder, limit }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.storage.from(bucket).list(folder || "", { limit: limit || 100 });
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length, files: data }, null, 2) }] };
  },
});

mcpServer.tool("delete_file", {
  description: "Delete a file from storage",
  inputSchema: {
    type: "object" as const,
    properties: {
      bucket: { type: "string" },
      path: { type: "string", description: "File path (or array of paths)" },
    },
    required: ["bucket", "path"],
  },
  handler: async ({ bucket, path }: any) => {
    const sb = getAdminClient();
    const paths = Array.isArray(path) ? path : [path];
    const { error } = await sb.storage.from(bucket).remove(paths);
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted: paths }) }] };
  },
});

mcpServer.tool("get_file_url", {
  description: "Get the permanent public URL for a file in storage",
  inputSchema: {
    type: "object" as const,
    properties: {
      bucket: { type: "string" },
      path: { type: "string" },
    },
    required: ["bucket", "path"],
  },
  handler: async ({ bucket, path }: any) => {
    const sb = getAdminClient();
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return { content: [{ type: "text" as const, text: JSON.stringify({ public_url: data.publicUrl }) }] };
  },
});

// ---------- CONTENT / AI TOOLS ----------

mcpServer.tool("generate_content", {
  description: "Generate content using the unified content API. Wrapper with typed params for easier use.",
  inputSchema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client UUID" },
      format: { type: "string", description: "Content format: tweet, thread, linkedin_post, instagram_caption, newsletter, article, etc." },
      topic: { type: "string", description: "Topic or title for the content" },
      additional_instructions: { type: "string", description: "Extra instructions for generation" },
      reference_urls: { type: "array", items: { type: "string" }, description: "URLs to use as reference" },
    },
    required: ["client_id", "format", "topic"],
  },
  handler: async ({ client_id, format, topic, additional_instructions, reference_urls }: any) => {
    try {
      const body: any = {
        action: "generate",
        clientId: client_id,
        format,
        title: topic,
      };
      if (additional_instructions) body.additionalInstructions = additional_instructions;
      if (reference_urls) body.referenceUrls = reference_urls;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/unified-content-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(body),
      });
      const data = await resp.text();
      let parsed;
      try { parsed = JSON.parse(data); } catch { parsed = data; }
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: resp.status, data: parsed }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  },
});

mcpServer.tool("analyze_url", {
  description: "Extract content from a URL using Firecrawl scraping. Returns markdown content.",
  inputSchema: {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "URL to scrape and analyze" },
      formats: { type: "array", items: { type: "string" }, description: "Output formats: markdown, html, links, screenshot (default: markdown)" },
    },
    required: ["url"],
  },
  handler: async ({ url, formats }: any) => {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/firecrawl-scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ url, options: { formats: formats || ["markdown"] } }),
      });
      const data = await resp.text();
      let parsed;
      try { parsed = JSON.parse(data); } catch { parsed = data; }
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: resp.status, data: parsed }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  },
});

// ---------- CLIENT MANAGEMENT TOOLS ----------

mcpServer.tool("update_client", {
  description: "Update client fields (voice_profile, identity_guide, description, content_guidelines, context_notes, etc.)",
  inputSchema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client UUID" },
      updates: { type: "object", description: "Fields to update (any columns from clients table)" },
    },
    required: ["client_id", "updates"],
  },
  handler: async ({ client_id, updates }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("clients").update(updates).eq("id", client_id).select().single();
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, client: data }, null, 2) }] };
  },
});

mcpServer.tool("create_viral_carousel", {
  description: "Create a Twitter-style viral carousel (Sequência Viral) for a client. By default persists BOTH the carousel and a draft planning_item linked to it, so it shows up in the planning board. Use this for 'carrossel viral', 'sequência viral', 'thread visual'. For a normal Instagram carousel, use generate_content with format='carousel' instead.",
  inputSchema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client UUID" },
      briefing: { type: "string", description: "Topic/angle for the carousel. Be specific — include hook + key points to cover. For news (slide_count=1), include headline + summary." },
      tone: { type: "string", description: "Optional tone (direto, provocativo, técnico, didático). If omitted, uses brand tone." },
      title: { type: "string", description: "Optional short title. Defaults to first 60 chars of briefing." },
      slide_count: { type: "number", description: "Number of slides. 1 = single news post (with cover image), 8 = standard carousel (default). Range 1-10." },
      persist_as: { type: "string", enum: ["planning", "carousel", "both", "none"], description: "Where to save. Default 'both' — creates a viral_carousel row AND a draft planning_item linked to it (recommended so it appears in the planning board)." },
      cover_image_url: { type: "string", description: "Optional cover image URL applied to slide 1 (e.g. RSS news image)." },
    },
    required: ["client_id", "briefing"],
  },
  handler: async ({ client_id, briefing, tone, title, slide_count, persist_as, cover_image_url }: any) => {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-viral-carousel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-call": "true",
        },
        body: JSON.stringify({
          clientId: client_id,
          briefing,
          tone,
          title,
          slideCount: slide_count,
          persistAs: persist_as ?? "both",
          source: "chat",
          coverImageUrl: cover_image_url,
        }),
      });
      const text = await resp.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: resp.status, data: parsed }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  },
});

mcpServer.tool("publish_content", {
  description: "Publish or schedule content to a connected social platform via Zernio (Late). Supports Instagram Stories, Reels (including TRIAL REELS shown only to non-followers), Carousels, Facebook Stories/Reels, plus collaborators and first comment. Use 'instagram_content_type' to choose feed/story/reel/carousel. Set 'instagram_trial_reel' to 'manual' or 'auto' to publish as a Trial Reel.",
  inputSchema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client UUID" },
      platform: { type: "string", enum: ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "threads"], description: "Target platform" },
      content: { type: "string", description: "Caption / text body" },
      media_urls: { type: "array", items: { type: "string" }, description: "Public media URLs (CDN, no Drive/Dropbox)" },
      planning_item_id: { type: "string", description: "Optional planning_items UUID to update on success" },
      scheduled_for: { type: "string", description: "ISO datetime to schedule. Omit to publish now." },
      // Instagram-specific
      instagram_content_type: { type: "string", enum: ["feed", "story", "reel", "carousel"], description: "Instagram only. Default: carousel if 2+ media, else feed." },
      instagram_share_to_feed: { type: "boolean", description: "Reels only. true = also show in feed (default), false = Reels tab only." },
      instagram_trial_reel: { type: "string", enum: ["off", "manual", "auto"], description: "Reels only. 'manual' = MANUAL graduation, 'auto' = SS_PERFORMANCE auto-graduate. Trial Reels are shown only to non-followers." },
      instagram_collaborators: { type: "array", items: { type: "string" }, description: "Up to 3 IG usernames (Business/Creator). Not for Stories." },
      instagram_first_comment: { type: "string", description: "Auto-posted as first comment. Not for Stories." },
      instagram_thumbnail_url: { type: "string", description: "Custom Reel cover (JPEG/PNG, 1080x1920)." },
      instagram_thumb_offset: { type: "number", description: "Reels only. Seconds offset into the video to use as cover (alternative to thumbnail_url)." },
      instagram_audio_name: { type: "string", description: "Reels only. Custom audio/track display name." },
      instagram_caption_override: { type: "string", description: "Override the caption just for Instagram." },
      // Facebook-specific
      facebook_content_type: { type: "string", enum: ["feed", "story", "reel"], description: "Facebook only." },
      facebook_first_comment: { type: "string" },
    },
    required: ["client_id", "platform"],
  },
  handler: async (args: any) => {
    const platformOptions: Record<string, any> = {};
    const ig: Record<string, any> = {};
    if (args.instagram_content_type) ig.contentType = args.instagram_content_type;
    if (typeof args.instagram_share_to_feed === "boolean") ig.shareToFeed = args.instagram_share_to_feed;
    if (args.instagram_trial_reel) ig.trialReel = args.instagram_trial_reel;
    if (Array.isArray(args.instagram_collaborators)) ig.collaborators = args.instagram_collaborators;
    if (args.instagram_first_comment) ig.firstComment = args.instagram_first_comment;
    if (args.instagram_thumbnail_url) ig.instagramThumbnail = args.instagram_thumbnail_url;
    if (typeof args.instagram_thumb_offset === "number") ig.thumbOffset = args.instagram_thumb_offset;
    if (args.instagram_audio_name) ig.audioName = args.instagram_audio_name;
    if (args.instagram_caption_override) ig.customCaption = args.instagram_caption_override;
    if (Object.keys(ig).length) platformOptions.instagram = ig;

    const fb: Record<string, any> = {};
    if (args.facebook_content_type) fb.contentType = args.facebook_content_type;
    if (args.facebook_first_comment) fb.firstComment = args.facebook_first_comment;
    if (Object.keys(fb).length) platformOptions.facebook = fb;

    const body: Record<string, any> = {
      clientId: args.client_id,
      platform: args.platform,
      content: args.content ?? "",
      mediaUrls: args.media_urls,
      planningItemId: args.planning_item_id,
      publishNow: !args.scheduled_for,
    };
    if (args.scheduled_for) body.scheduledFor = args.scheduled_for;
    if (Object.keys(platformOptions).length) body.platformOptions = platformOptions;

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/late-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(body),
      });
      const text = await resp.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: resp.status, data: parsed }, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  },
});

mcpServer.tool("list_clients", {
  description: "List all clients in a workspace",
  inputSchema: {
    type: "object" as const,
    properties: {
      workspace_id: { type: "string", description: "Workspace UUID" },
    },
    required: ["workspace_id"],
  },
  handler: async ({ workspace_id }: any) => {
    const sb = getAdminClient();
    const { data, error } = await sb.from("clients").select("id, name, description, avatar_url, created_at").eq("workspace_id", workspace_id).order("name");
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify({ count: data?.length, clients: data }, null, 2) }] };
  },
});

// ============ HTTP Transport ============

const app = new Hono();
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);

// Auth middleware - validate MCP_ACCESS_TOKEN
app.use("/*", async (c, next) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (token !== MCP_ACCESS_TOKEN) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

app.all("/*", async (c) => {
  return await httpHandler(c.req.raw);
});

Deno.serve(app.fetch);
