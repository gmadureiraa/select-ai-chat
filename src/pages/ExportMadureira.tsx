import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CLIENT_ID = "c3fdf44d-1eb5-49f0-aa91-a030642b5396";

function toCsv(data: any[], filename: string) {
  if (!data || data.length === 0) return null;
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export default function ExportMadureira() {
  const [status, setStatus] = useState<string[]>([]);

  const log = (msg: string) => setStatus(prev => [...prev, msg]);

  useEffect(() => {
    async function exportAll() {
      log("Iniciando export do cliente Gabriel Madureira...");

      // Profile
      const { data: profile } = await supabase.from("clients").select("*").eq("id", CLIENT_ID).single();
      if (profile) { toCsv([profile], "madureira_perfil.csv"); log("✅ Perfil exportado"); }

      // Twitter posts
      const { data: tweets } = await supabase.from("twitter_posts").select("*").eq("client_id", CLIENT_ID).order("posted_at", { ascending: false });
      if (tweets?.length) { toCsv(tweets, "madureira_twitter_posts.csv"); log(`✅ Twitter: ${tweets.length} posts`); }

      // LinkedIn posts
      const { data: linkedin } = await supabase.from("linkedin_posts").select("*").eq("client_id", CLIENT_ID).order("posted_at", { ascending: false });
      if (linkedin?.length) { toCsv(linkedin, "madureira_linkedin_posts.csv"); log(`✅ LinkedIn: ${linkedin.length} posts`); }

      // Instagram posts
      const { data: insta } = await supabase.from("instagram_posts").select("*").eq("client_id", CLIENT_ID).order("posted_at", { ascending: false });
      if (insta?.length) { toCsv(insta, "madureira_instagram_posts.csv"); log(`✅ Instagram: ${insta.length} posts`); }
      else { log("⚠️ Instagram: 0 posts"); }

      // Instagram stories
      const { data: stories } = await supabase.from("instagram_stories").select("*").eq("client_id", CLIENT_ID);
      if (stories?.length) { toCsv(stories, "madureira_instagram_stories.csv"); log(`✅ Stories: ${stories.length}`); }
      else { log("⚠️ Stories: 0"); }

      // YouTube videos
      const { data: yt } = await supabase.from("youtube_videos").select("*").eq("client_id", CLIENT_ID);
      if (yt?.length) { toCsv(yt, "madureira_youtube_videos.csv"); log(`✅ YouTube: ${yt.length} vídeos`); }
      else { log("⚠️ YouTube: 0 vídeos"); }

      // Platform metrics
      const { data: metrics } = await supabase.from("platform_metrics").select("*").eq("client_id", CLIENT_ID).order("metric_date", { ascending: false });
      if (metrics?.length) { toCsv(metrics, "madureira_platform_metrics.csv"); log(`✅ Métricas: ${metrics.length} registros`); }

      // Content Library
      const { data: content } = await supabase.from("client_content_library").select("*").eq("client_id", CLIENT_ID).order("created_at", { ascending: false });
      if (content?.length) { toCsv(content, "madureira_content_library.csv"); log(`✅ Content Library: ${content.length} itens`); }

      // Reference Library
      const { data: refs } = await supabase.from("client_reference_library").select("*").eq("client_id", CLIENT_ID).order("created_at", { ascending: false });
      if (refs?.length) { toCsv(refs, "madureira_reference_library.csv"); log(`✅ Reference Library: ${refs.length} itens`); }

      // Visual References
      const { data: visuals } = await supabase.from("client_visual_references").select("*").eq("client_id", CLIENT_ID);
      if (visuals?.length) { toCsv(visuals, "madureira_visual_references.csv"); log(`✅ Visual References: ${visuals.length} itens`); }

      log("🎉 Export completo!");
    }

    exportAll();
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "monospace", background: "#111", color: "#0f0", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 20 }}>Export: Gabriel Madureira</h1>
      {status.map((s, i) => <div key={i}>{s}</div>)}
    </div>
  );
}
