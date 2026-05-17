// Migrated from supabase/functions/mcp-reader/index.ts
// Original was a Hono+mcp-lite Streamable HTTP MCP server. The Vercel Function
// version exposes the same tool catalog as introspectable JSON (`/api/mcp-reader`
// or `/api/mcp-reader?action=list`) plus a basic `tools/list` JSON-RPC handler
// so MCP clients can read the catalog. The actual KAI MCP transport is hosted
// elsewhere; this endpoint serves as the discovery surface.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError } from '../_lib/cors.js';

interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

const TOOLS: ToolSpec[] = [
  {
    name: 'list_tables',
    description: 'List all available database tables with row counts',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'query_table',
    description:
      'Query any table with optional filters, ordering, and pagination. Supports read-only SELECT queries.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        select: { type: 'string', description: 'Columns to select (default: *)' },
        filters: {
          type: 'array',
          description:
            'Array of filter objects: {column, operator, value}. Operators: eq, neq, gt, gte, lt, lte, like, ilike, is, in',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: { type: 'string' },
              value: {},
            },
          },
        },
        order: { type: 'string', description: 'Column to order by' },
        ascending: { type: 'boolean', description: 'Sort ascending (default: false)' },
        limit: { type: 'number', description: 'Max rows (default: 100, max: 1000)' },
        offset: { type: 'number', description: 'Offset for pagination' },
      },
      required: ['table'],
    },
  },
  {
    name: 'get_client',
    description:
      'Get full client profile with all related data (social credentials, websites, documents, voice profile, guidelines)',
    inputSchema: {
      type: 'object',
      properties: { client_id: { type: 'string', description: 'Client UUID' } },
      required: ['client_id'],
    },
  },
  {
    name: 'get_content_library',
    description: 'Get content library items for a client',
    inputSchema: {
      type: 'object',
      properties: { client_id: { type: 'string' }, limit: { type: 'number' } },
      required: ['client_id'],
    },
  },
  {
    name: 'get_references',
    description: 'Get reference library items for a client',
    inputSchema: {
      type: 'object',
      properties: { client_id: { type: 'string' }, limit: { type: 'number' } },
      required: ['client_id'],
    },
  },
  {
    name: 'get_metrics',
    description:
      'Get platform metrics and social posts for a client (twitter, linkedin, instagram, youtube)',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        platform: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'get_automations',
    description: 'Get all automations and planning automations for a client',
    inputSchema: {
      type: 'object',
      properties: { client_id: { type: 'string' } },
      required: ['client_id'],
    },
  },
  {
    name: 'get_planning',
    description: 'Get planning items (kanban cards, scheduled posts) for a client or workspace',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        workspace_id: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'search_knowledge',
    description: 'Search the global knowledge base by keyword or text',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        workspace_id: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_schema',
    description: 'Get the column names and types for a specific table',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' } },
      required: ['table'],
    },
  },
  {
    name: 'create_planning_item',
    description:
      "Create a new planning item (content card) for a client. For threads pass 'thread_items' as an array of posts.",
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        workspace_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        platform: { type: 'string' },
        target_platforms: { type: 'array', items: { type: 'string' } },
        content_type: { type: 'string' },
        status: { type: 'string' },
        scheduled_at: { type: 'string' },
        content: { type: 'string' },
        image_url: { type: 'string' },
        thread_items: { type: 'array' },
      },
      required: ['client_id', 'workspace_id', 'title'],
    },
  },
  {
    name: 'update_planning_item',
    description: 'Update an existing planning item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        status: { type: 'string' },
        platform: { type: 'string' },
        scheduled_at: { type: 'string' },
        image_url: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_automation',
    description: 'Update a planning automation (prompt, schedule, config, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        updates: { type: 'object' },
      },
      required: ['id', 'updates'],
    },
  },
  {
    name: 'insert_row',
    description: 'Insert a row into any table. Use with caution.',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, row: { type: 'object' } },
      required: ['table', 'row'],
    },
  },
  {
    name: 'update_row',
    description: 'Update rows in any table by ID',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        id: { type: 'string' },
        updates: { type: 'object' },
      },
      required: ['table', 'id', 'updates'],
    },
  },
  {
    name: 'delete_row',
    description: 'Delete a row from any table by ID',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' }, id: { type: 'string' } },
      required: ['table', 'id'],
    },
  },
  {
    name: 'invoke_function',
    description: 'Invoke any backend function',
    inputSchema: {
      type: 'object',
      properties: { function_name: { type: 'string' }, body: { type: 'object' } },
      required: ['function_name'],
    },
  },
  {
    name: 'upload_file',
    description: 'Upload a file to storage via URL or base64. Returns permanent public URL.',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string' },
        path: { type: 'string' },
        file_url: { type: 'string' },
        base64: { type: 'string' },
        content_type: { type: 'string' },
      },
      required: ['bucket', 'path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a storage bucket/folder',
    inputSchema: {
      type: 'object',
      properties: {
        bucket: { type: 'string' },
        folder: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['bucket'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from storage',
    inputSchema: {
      type: 'object',
      properties: { bucket: { type: 'string' }, path: { type: 'string' } },
      required: ['bucket', 'path'],
    },
  },
  {
    name: 'get_file_url',
    description: 'Get the permanent public URL for a file in storage',
    inputSchema: {
      type: 'object',
      properties: { bucket: { type: 'string' }, path: { type: 'string' } },
      required: ['bucket', 'path'],
    },
  },
  {
    name: 'generate_content',
    description: 'Generate content using the unified content API.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        format: { type: 'string' },
        topic: { type: 'string' },
        additional_instructions: { type: 'string' },
        reference_urls: { type: 'array', items: { type: 'string' } },
      },
      required: ['client_id', 'format', 'topic'],
    },
  },
  {
    name: 'analyze_url',
    description: 'Extract content from a URL using Firecrawl scraping. Returns markdown content.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        formats: { type: 'array', items: { type: 'string' } },
      },
      required: ['url'],
    },
  },
  {
    name: 'update_client',
    description:
      'Update client fields (voice_profile, identity_guide, description, content_guidelines, context_notes, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        updates: { type: 'object' },
      },
      required: ['client_id', 'updates'],
    },
  },
  {
    name: 'create_viral_carousel',
    description:
      'Create a Twitter-style viral carousel (Sequência Viral) for a client. By default persists BOTH the carousel and a draft planning_item linked to it.',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        briefing: { type: 'string' },
        tone: { type: 'string' },
        title: { type: 'string' },
        slide_count: { type: 'number' },
        persist_as: { type: 'string', enum: ['planning', 'carousel', 'both', 'none'] },
        cover_image_url: { type: 'string' },
      },
      required: ['client_id', 'briefing'],
    },
  },
  {
    name: 'publish_content',
    description:
      'Publish or schedule content to a connected social platform (Late). Supports Instagram, Facebook, X, LinkedIn, TikTok, YouTube and Threads (incl. multi-post threads).',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube', 'threads'],
        },
        content: { type: 'string' },
        media_urls: { type: 'array', items: { type: 'string' } },
        planning_item_id: { type: 'string' },
        scheduled_for: { type: 'string' },
        thread_items: { type: 'array' },
      },
      required: ['client_id', 'platform'],
    },
  },
  {
    name: 'list_clients',
    description: 'List all clients in a workspace',
    inputSchema: {
      type: 'object',
      properties: { workspace_id: { type: 'string' } },
      required: ['workspace_id'],
    },
  },
];

const SERVER_INFO = {
  name: 'kaleidos-mcp',
  version: '1.0.0',
  description:
    'KAI/Kaleidos MCP server tool catalog. The streamable HTTP transport is hosted at the Supabase mcp-reader endpoint; this Vercel handler exposes the same tool list as plain JSON for discovery and JSON-RPC tools/list.',
};

function authorized(req: VercelRequest): boolean {
  // SECURITY (2026-05-17): se nenhum token estiver configurado, BLOQUEAR em vez
  // de abrir discovery. O catálogo MCP revela nomes de tools + shape de input
  // schema — info útil pra reconnaissance + prompt injection planning.
  const expected = process.env.MCP_ACCESS_TOKEN || process.env.KAI_MCP_TOKEN;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  const headerVal = Array.isArray(header) ? header[0] : header;
  const token = headerVal.replace(/^Bearer\s+/i, '');
  return token === expected;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(res, req);

  if (!authorized(req)) {
    return jsonError(res, 401, 'Unauthorized — provide MCP_ACCESS_TOKEN bearer');
  }

  // GET / -> simple JSON catalog
  if (req.method === 'GET') {
    return res.status(200).json({
      ...SERVER_INFO,
      tools: TOOLS,
      tool_count: TOOLS.length,
    });
  }

  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed');
  }

  // JSON-RPC 2.0 minimal handler — supports `initialize`, `tools/list`,
  // `tools/call` (returns a stub error directing callers to the live MCP).
  let body: any = {};
  try {
    body = req.body && typeof req.body === 'object' ? req.body : req.body ? JSON.parse(req.body) : {};
  } catch {
    return jsonError(res, 400, 'Invalid JSON body');
  }

  // Plain catalog request (non-RPC)
  if (!body.jsonrpc) {
    return res.status(200).json({
      ...SERVER_INFO,
      tools: TOOLS,
      tool_count: TOOLS.length,
    });
  }

  const id = body.id ?? null;
  const method = body.method as string | undefined;

  if (method === 'initialize') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
  }

  if (method === 'tools/list') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS },
    });
  }

  if (method === 'tools/call') {
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message:
          'Tools cannot be invoked through /api/mcp-reader. Use the dedicated tool endpoints (e.g. /api/generate-content-v2, /api/firecrawl-scrape, /api/late-post) directly.',
      },
    });
  }

  return res.status(200).json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}
