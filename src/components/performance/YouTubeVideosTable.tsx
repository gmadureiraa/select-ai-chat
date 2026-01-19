import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Search, ExternalLink, Youtube, Play, FileText, Library, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { YouTubeVideoSyncButton } from "./YouTubeVideoSyncButton";
import { YouTubeTranscriptDialog } from "./YouTubeTranscriptDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface YouTubeVideo {
  id: string;
  client_id?: string;
  video_id: string;
  title: string;
  published_at: string | null;
  total_views: number | null;
  watch_hours: number | null;
  subscribers_gained: number | null;
  impressions: number | null;
  click_rate: number | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  transcript?: string | null;
  content_synced_at?: string | null;
  content_library_id?: string | null;
}

interface YouTubeVideosTableProps {
  videos: YouTubeVideo[];
  clientId?: string;
  isLoading?: boolean;
}

type SortField = "published_at" | "total_views" | "watch_hours" | "subscribers_gained" | "click_rate";
type SortOrder = "asc" | "desc";

const getPerformanceBadge = (views: number | null) => {
  if (!views) return null;
  if (views >= 100000) return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">🔥 Viral</Badge>;
  if (views >= 50000) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✓ Bom</Badge>;
  if (views >= 10000) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">• Médio</Badge>;
  return <Badge className="bg-muted text-muted-foreground">Novo</Badge>;
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export function YouTubeVideosTable({ videos, clientId, isLoading }: YouTubeVideosTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("total_views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredVideos = videos
    .filter((video) => {
      return !search || video.title?.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  // Get clientId from first video if not provided as prop
  const effectiveClientId = clientId || videos[0]?.client_id || "";

  // Count videos that need syncing (have transcript but no library_id)
  const videosNeedingSync = videos.filter(v => v.transcript && !v.content_library_id);
  const videosWithoutTranscript = videos.filter(v => !v.transcript && !v.content_library_id);

  const handleBatchSync = async () => {
    if (!effectiveClientId || videosNeedingSync.length === 0) return;

    setIsBatchSyncing(true);
    let synced = 0;
    let errors = 0;

    toast.info(`Sincronizando ${videosNeedingSync.length} vídeos para biblioteca...`);

    for (const video of videosNeedingSync) {
      try {
        // Insert into content library
        const { data: libraryEntry, error: insertError } = await supabase
          .from("client_content_library")
          .upsert({
            client_id: effectiveClientId,
            title: video.title || `Vídeo YouTube`,
            content: video.transcript || `Vídeo: ${video.title}`,
            content_type: "video_script",
            content_url: `https://youtube.com/watch?v=${video.video_id}`,
            thumbnail_url: video.thumbnail_url || `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`,
            metadata: {
              synced_from_performance: true,
              video_id: video.video_id,
              published_at: video.published_at,
              has_transcript: true,
            },
          }, {
            onConflict: 'client_id,content_type,content_url',
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          errors++;
          continue;
        }

        // Update youtube_videos with library link
        await supabase
          .from("youtube_videos")
          .update({
            content_synced_at: new Date().toISOString(),
            content_library_id: libraryEntry.id,
          })
          .eq("id", video.id);

        synced++;
      } catch (err) {
        console.error("Batch sync error for video:", video.id, err);
        errors++;
      }
    }

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["youtube-videos"] });
    queryClient.invalidateQueries({ queryKey: ["unified-content"] });
    queryClient.invalidateQueries({ queryKey: ["content-library"] });
    queryClient.invalidateQueries({ queryKey: ["client-content-library"] });

    setIsBatchSyncing(false);

    if (synced > 0) {
      toast.success(`${synced} vídeo(s) sincronizado(s) para biblioteca!`);
    }
    if (errors > 0) {
      toast.error(`${errors} erro(s) durante sincronização`);
    }
  };

  const openVideoDialog = (video: YouTubeVideo) => {
    setSelectedVideo(video);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted/50 rounded animate-pulse" />
        <div className="h-64 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Youtube className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum vídeo do YouTube importado</p>
        <p className="text-sm mt-1">Conecte sua conta ou faça upload do CSV</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Batch sync button */}
        {videosNeedingSync.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchSync}
            disabled={isBatchSyncing}
            className="whitespace-nowrap"
          >
            {isBatchSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Library className="h-4 w-4 mr-1.5" />
                Sincronizar {videosNeedingSync.length} para Biblioteca
              </>
            )}
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Thumbnail</TableHead>
              <TableHead className="min-w-[200px]">Título</TableHead>
              <TableHead className="w-[100px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("published_at")}>
                  Data <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[90px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("total_views")}>
                  Views <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("watch_hours")}>
                  Watch H. <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[70px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("click_rate")}>
                  CTR <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[140px]">Transcrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVideos.map((video) => (
              <TableRow key={video.id} className="group cursor-pointer" onClick={() => openVideoDialog(video)}>
                <TableCell>
                  <div className="relative group/thumb">
                    {/* Auto-generate thumbnail from video_id if not available */}
                    {(video.thumbnail_url || video.video_id) ? (
                      <img 
                        src={video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`} 
                        alt={video.title}
                        className="w-20 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-20 h-12 rounded bg-muted flex items-center justify-center">
                        <Youtube className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <Play className="h-5 w-5 text-white" fill="white" />
                    </div>
                    {video.duration_seconds && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                        {formatDuration(video.duration_seconds)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-medium line-clamp-2 flex-1">
                      {video.title}
                    </p>
                    <a 
                      href={`https://youtube.com/watch?v=${video.video_id}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {video.published_at 
                    ? format(new Date(video.published_at), "dd/MM/yy", { locale: ptBR })
                    : "-"
                  }
                </TableCell>
                <TableCell className="font-medium">
                  {video.total_views?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {video.watch_hours?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="font-medium">
                  {video.click_rate?.toFixed(1) || 0}%
                </TableCell>
                <TableCell>
                  {getPerformanceBadge(video.total_views)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {video.transcript && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          openVideoDialog(video);
                        }}
                      >
                        <FileText className="h-3 w-3" />
                        Ver
                      </Button>
                    )}
                    <YouTubeVideoSyncButton
                      videoId={video.video_id}
                      videoDbId={video.id}
                      clientId={effectiveClientId}
                      title={video.title}
                      thumbnailUrl={video.thumbnail_url}
                      publishedAt={video.published_at}
                      contentSyncedAt={video.content_synced_at || null}
                      contentLibraryId={video.content_library_id}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <p>
          Mostrando {filteredVideos.length} de {videos.length} vídeos
        </p>
        <div className="flex gap-3">
          {videosNeedingSync.length > 0 && (
            <span className="text-orange-600">
              {videosNeedingSync.length} com transcrição pendente sincronização
            </span>
          )}
          {videosWithoutTranscript.length > 0 && (
            <span className="text-muted-foreground">
              {videosWithoutTranscript.length} sem transcrição
            </span>
          )}
        </div>
      </div>

      {/* Transcript Dialog */}
      <YouTubeTranscriptDialog
        video={selectedVideo}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={effectiveClientId}
        onSyncComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["youtube-videos"] });
        }}
      />
    </div>
  );
}
