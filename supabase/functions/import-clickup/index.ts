import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLICKUP_API = "https://api.clickup.com/api/v2";

interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: { status: string };
  priority: { id: string; priority: string } | null;
  due_date: string | null;
  start_date: string | null;
  tags: { name: string }[];
  attachments?: { id: string; url: string; title: string; extension: string }[];
  list?: { name: string };
  folder?: { name: string };
}

async function clickupFetch(path: string, token: string) {
  const res = await fetch(`${CLICKUP_API}${path}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClickUp API ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

function inferPlatform(tags: string[], listName: string, folderName: string): string | null {
  const all = [...tags.map(t => t.toLowerCase()), listName.toLowerCase(), folderName.toLowerCase()].join(" ");
  if (all.includes("instagram") || all.includes("reels") || all.includes("carrossel") || all.includes("stories")) return "instagram";
  if (all.includes("twitter") || all.includes("tweet") || all.includes("thread") || all.includes("x ")) return "twitter";
  if (all.includes("linkedin")) return "linkedin";
  if (all.includes("tiktok")) return "tiktok";
  if (all.includes("youtube")) return "youtube";
  if (all.includes("newsletter") || all.includes("email")) return "newsletter";
  if (all.includes("blog")) return "blog";
  if (all.includes("facebook")) return "facebook";
  if (all.includes("threads")) return "threads";
  return null;
}

function inferContentType(tags: string[], listName: string): string | null {
  const all = [...tags.map(t => t.toLowerCase()), listName.toLowerCase()].join(" ");
  if (all.includes("stories") || all.includes("story")) return "stories";
  if (all.includes("reels") || all.includes("reel")) return "reels";
  if (all.includes("carrossel") || all.includes("carousel")) return "carousel";
  if (all.includes("feed") || all.includes("post")) return "feed";
  if (all.includes("thread")) return "thread";
  if (all.includes("newsletter") || all.includes("email marketing")) return "newsletter";
  if (all.includes("tweet")) return "tweet";
  if (all.includes("blog") || all.includes("artigo")) return "article";
  if (all.includes("vídeo") || all.includes("video")) return "video";
  return null;
}

function mapPriority(p: ClickUpTask["priority"]): string {
  if (!p) return "medium";
  switch (p.id) {
    case "1": return "urgent";
    case "2": return "high";
    case "3": return "medium";
    case "4": return "low";
    default: return "medium";
  }
}

function mapStatusToColumnType(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("idea") || s.includes("ideia") || s.includes("backlog")) return "idea";
  if (s.includes("rascunho") || s.includes("draft") || s.includes("em progresso") || s.includes("in progress") || s.includes("doing")) return "draft";
  if (s.includes("revis") || s.includes("review")) return "review";
  if (s.includes("aprov") || s.includes("approved") || s.includes("done") || s.includes("complete") || s.includes("conclu")) return "approved";
  if (s.includes("agend") || s.includes("sched")) return "scheduled";
  if (s.includes("publi")) return "published";
  return "idea";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const CLICKUP_TOKEN = Deno.env.get("CLICKUP_API_TOKEN");
    if (!CLICKUP_TOKEN) {
      return new Response(JSON.stringify({ error: "CLICKUP_API_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ACTION: discover - list teams and spaces
    if (action === "discover") {
      const teamsRes = await clickupFetch("/team", CLICKUP_TOKEN);
      const teams = teamsRes.teams || [];
      
      const result: { team_id: string; team_name: string; spaces: { id: string; name: string; lists: { id: string; name: string; folder: string | null }[] }[] }[] = [];

      for (const team of teams) {
        const spacesRes = await clickupFetch(`/team/${team.id}/space?archived=false`, CLICKUP_TOKEN);
        const spaces = spacesRes.spaces || [];
        const spaceData: typeof result[0]["spaces"] = [];

        for (const space of spaces) {
          const lists: { id: string; name: string; folder: string | null }[] = [];
          
          // Folderless lists
          const folderlessRes = await clickupFetch(`/space/${space.id}/list?archived=false`, CLICKUP_TOKEN);
          for (const list of folderlessRes.lists || []) {
            lists.push({ id: list.id, name: list.name, folder: null });
          }

          // Folders and their lists
          const foldersRes = await clickupFetch(`/space/${space.id}/folder?archived=false`, CLICKUP_TOKEN);
          for (const folder of foldersRes.folders || []) {
            for (const list of folder.lists || []) {
              lists.push({ id: list.id, name: list.name, folder: folder.name });
            }
          }

          spaceData.push({ id: space.id, name: space.name, lists });
        }
        result.push({ team_id: team.id, team_name: team.name, spaces: spaceData });
      }

      return new Response(JSON.stringify({ teams: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: import - fetch tasks and insert
    if (action === "import") {
      const body = await req.json();
      const { workspace_id, mappings, since_date } = body as {
        workspace_id: string;
        mappings: { list_id: string; client_id: string; space_name: string; folder_name: string }[];
        since_date?: string;
      };

      if (!workspace_id || !mappings?.length) {
        return new Response(JSON.stringify({ error: "workspace_id and mappings required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get kanban columns for this workspace
      const { data: columns } = await supabase
        .from("kanban_columns")
        .select("id, column_type")
        .eq("workspace_id", workspace_id);

      const columnMap = new Map<string, string>();
      for (const col of columns || []) {
        if (col.column_type) columnMap.set(col.column_type, col.id);
      }

      const sinceTs = since_date ? new Date(since_date).getTime() : new Date("2026-04-01").getTime();

      let imported = 0;
      let skipped = 0;
      let errors: string[] = [];

      const serviceSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      for (const mapping of mappings) {
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          try {
            const tasksRes = await clickupFetch(
              `/list/${mapping.list_id}/task?archived=false&page=${page}&order_by=due_date&date_updated_gt=${sinceTs}&include_closed=true&subtasks=true`,
              CLICKUP_TOKEN
            );

            const tasks: ClickUpTask[] = tasksRes.tasks || [];
            if (tasks.length === 0) {
              hasMore = false;
              break;
            }

            for (const task of tasks) {
              try {
                // Check dedup
                const { data: existing } = await supabase
                  .from("planning_items")
                  .select("id")
                  .eq("workspace_id", workspace_id)
                  .contains("metadata", { clickup_task_id: task.id })
                  .maybeSingle();

                if (existing) {
                  skipped++;
                  continue;
                }

                const tagNames = task.tags.map(t => t.name);
                const listName = task.list?.name || "";
                const folderName = task.folder?.name || mapping.folder_name || "";
                const platform = inferPlatform(tagNames, listName, folderName);
                const contentType = inferContentType(tagNames, listName);
                const priority = mapPriority(task.priority);
                const statusColumnType = mapStatusToColumnType(task.status.status);
                const columnId = columnMap.get(statusColumnType) || columnMap.get("idea") || null;

                // Handle attachments
                let mediaUrls: string[] = [];
                try {
                  const attachRes = await clickupFetch(`/task/${task.id}?include_subtasks=false`, CLICKUP_TOKEN);
                  const attachments = attachRes.attachments || [];
                  
                  for (const att of attachments.slice(0, 10)) {
                    try {
                      const imgRes = await fetch(att.url);
                      if (imgRes.ok) {
                        const blob = await imgRes.blob();
                        const ext = att.extension || "jpg";
                        const path = `clickup/${workspace_id}/${task.id}/${att.id}.${ext}`;
                        
                        const { error: uploadErr } = await serviceSupabase.storage
                          .from("planning-media")
                          .upload(path, blob, { contentType: blob.type, upsert: true });
                        
                        if (!uploadErr) {
                          const { data: urlData } = serviceSupabase.storage
                            .from("planning-media")
                            .getPublicUrl(path);
                          if (urlData?.publicUrl) mediaUrls.push(urlData.publicUrl);
                        }
                      }
                    } catch {
                      // Fallback: save original URL in metadata
                    }
                  }
                } catch {
                  // Skip attachments on error
                }

                // Parse dates
                let scheduledAt: string | null = null;
                let dueDate: string | null = null;
                if (task.due_date) {
                  const d = new Date(parseInt(task.due_date));
                  if (!isNaN(d.getTime())) {
                    scheduledAt = d.toISOString();
                  }
                }

                const { error: insertErr } = await supabase
                  .from("planning_items")
                  .insert({
                    workspace_id,
                    client_id: mapping.client_id,
                    title: task.name,
                    content: task.description || null,
                    platform: platform as any,
                    content_type: contentType,
                    scheduled_at: scheduledAt,
                    due_date: dueDate,
                    status: statusColumnType === "published" ? "published" : "idea",
                    priority: priority as any,
                    labels: tagNames,
                    media_urls: mediaUrls,
                    column_id: columnId,
                    created_by: userId,
                    metadata: {
                      clickup_task_id: task.id,
                      clickup_list: listName,
                      clickup_folder: folderName,
                      clickup_space: mapping.space_name,
                      clickup_status: task.status.status,
                    },
                  });

                if (insertErr) {
                  errors.push(`Task "${task.name}": ${insertErr.message}`);
                } else {
                  imported++;
                }
              } catch (e) {
                errors.push(`Task "${task.name}": ${e.message}`);
              }
            }

            if (tasks.length < 100) hasMore = false;
            else page++;
          } catch (e) {
            errors.push(`List ${mapping.list_id}: ${e.message}`);
            hasMore = false;
          }
        }
      }

      return new Response(JSON.stringify({ imported, skipped, errors: errors.slice(0, 20) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use ?action=discover or ?action=import" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-clickup error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
