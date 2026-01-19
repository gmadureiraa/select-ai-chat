import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Library, FileText, Calendar, Eye, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { YouTubeVideoSyncButton } from "./YouTubeVideoSyncButton";

interface YouTubeVideo {
  id: string;
  client_id?: string;
  video_id: string;
  title: string;
  published_at: string | null;
  total_views: number | null;
  watch_hours: number | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  transcript?: string | null;
  content_synced_at?: string | null;
  content_library_id?: string | null;
}

interface YouTubeTranscriptDialogProps {
  video: YouTubeVideo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSyncComplete?: () => void;
}

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

export function YouTubeTranscriptDialog({
  video,
  open,
  onOpenChange,
  clientId,
  onSyncComplete,
}: YouTubeTranscriptDialogProps) {
  if (!video) return null;

  const thumbnailUrl = video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`;
  const hasTranscript = video.transcript && video.transcript.length > 0;
  const isInLibrary = !!video.content_library_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold line-clamp-2 pr-8">
            {video.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0">
          {/* Thumbnail */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            <img
              src={thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`;
              }}
            />
            {video.duration_seconds && (
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {formatDuration(video.duration_seconds)}
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {video.published_at && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(new Date(video.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            )}
            {video.total_views != null && (
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                {video.total_views.toLocaleString()} views
              </div>
            )}
            {video.watch_hours != null && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {video.watch_hours.toLocaleString()} horas assistidas
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://youtube.com/watch?v=${video.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Abrir no YouTube
              </a>
            </Button>

            <YouTubeVideoSyncButton
              videoId={video.video_id}
              videoDbId={video.id}
              clientId={clientId}
              title={video.title}
              thumbnailUrl={video.thumbnail_url}
              publishedAt={video.published_at}
              contentSyncedAt={video.content_synced_at || null}
              contentLibraryId={video.content_library_id}
              onSyncComplete={onSyncComplete}
            />

            {isInLibrary && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <Library className="h-3 w-3 mr-1" />
                Na Biblioteca
              </Badge>
            )}
          </div>

          {/* Transcript */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Transcrição</h3>
            </div>

            {hasTranscript ? (
              <ScrollArea className="h-[250px] border rounded-lg p-4 bg-muted/30">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {video.transcript}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[120px] border rounded-lg p-4 bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Transcrição não disponível</p>
                <p className="text-xs mt-1">Clique em "Transcrever + Biblioteca" para gerar</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
