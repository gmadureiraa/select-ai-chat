import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Search, ExternalLink, Youtube, Play } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface YouTubeVideo {
  id: string;
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
}

interface YouTubeVideosTableProps {
  videos: YouTubeVideo[];
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

export function YouTubeVideosTable({ videos, isLoading }: YouTubeVideosTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("total_views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Thumbnail</TableHead>
              <TableHead className="min-w-[250px]">Título</TableHead>
              <TableHead className="w-[100px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("published_at")}>
                  Data <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("total_views")}>
                  Views <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("watch_hours")}>
                  Watch H. <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("subscribers_gained")}>
                  Subs+ <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[80px]">
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleSort("click_rate")}>
                  CTR <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVideos.map((video) => (
              <TableRow key={video.id} className="group">
                <TableCell>
                  <a
                    href={`https://youtube.com/watch?v=${video.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative group/thumb"
                  >
                    {video.thumbnail_url ? (
                      <img 
                        src={video.thumbnail_url} 
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
                  </a>
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
                <TableCell className="text-muted-foreground">
                  {video.subscribers_gained?.toLocaleString() || 0}
                </TableCell>
                <TableCell className="font-medium">
                  {video.click_rate?.toFixed(1) || 0}%
                </TableCell>
                <TableCell>
                  {getPerformanceBadge(video.total_views)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Mostrando {filteredVideos.length} de {videos.length} vídeos
      </p>
    </div>
  );
}
