import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Target, Heart, MessageCircle, Share2, ArrowRight, ArrowLeft, LogOut, Play, Image as ImageIcon } from "lucide-react";
import { InstagramStory } from "@/hooks/useInstagramStories";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { InstagramStoriesCSVUpload } from "./InstagramStoriesCSVUpload";

interface InstagramStoriesSectionProps {
  stories: InstagramStory[];
  isLoading?: boolean;
  period?: string;
  clientId: string;
  onRefresh?: () => void;
}

const formatNumber = (num?: number | null) => {
  if (!num) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('pt-BR');
};

const MetricRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs">{label}</span>
    </div>
    <span className="text-xs font-medium">{typeof value === 'number' ? formatNumber(value) : value}</span>
  </div>
);

export function InstagramStoriesSection({ 
  stories, 
  isLoading,
  period = "30",
  clientId,
  onRefresh,
}: InstagramStoriesSectionProps) {
  // Stories are now pre-filtered from the parent component
  // We just use them directly
  const filteredStories = stories;

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalViews = filteredStories.reduce((sum, s) => sum + (s.views || 0), 0);
    const totalReach = filteredStories.reduce((sum, s) => sum + (s.reach || 0), 0);
    const totalInteractions = filteredStories.reduce((sum, s) => sum + (s.interactions || 0), 0);
    const avgRetention = filteredStories.length > 0
      ? filteredStories.reduce((sum, s) => sum + (s.retention_rate || 0), 0) / filteredStories.length
      : 0;
    
    return { totalViews, totalReach, totalInteractions, avgRetention };
  }, [filteredStories]);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Stories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[280px] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filteredStories.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Stories</CardTitle>
            <InstagramStoriesCSVUpload clientId={clientId} onSuccess={onRefresh} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum story encontrado neste período</p>
            <p className="text-xs mt-1">Importe dados de stories via CSV para visualizar métricas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Stories</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatNumber(stats.totalViews)}</span>
                <span className="text-muted-foreground text-xs">views</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatNumber(stats.totalReach)}</span>
                <span className="text-muted-foreground text-xs">alcance</span>
              </div>
            </div>
            <InstagramStoriesCSVUpload clientId={clientId} onSuccess={onRefresh} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStories.slice(0, 12).map((story) => (
            <div 
              key={story.id}
              className="rounded-xl border border-border/50 overflow-hidden bg-card/50 hover:bg-card/80 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[9/16] max-h-[180px] bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20">
                {story.thumbnail_url ? (
                  <img
                    src={story.thumbnail_url}
                    alt="Story"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {story.media_type === "video" ? (
                      <Play className="h-8 w-8 text-white/60" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-white/60" />
                    )}
                  </div>
                )}
                {/* Date badge */}
                {story.posted_at && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm">
                    <span className="text-[10px] text-white font-medium">
                      {format(parseISO(story.posted_at), "dd MMM", { locale: ptBR })}
                    </span>
                  </div>
                )}
                {/* Media type badge */}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm">
                  <span className="text-[10px] text-white uppercase font-medium">
                    {story.media_type || 'img'}
                  </span>
                </div>
              </div>

              {/* Metrics */}
              <div className="p-3 space-y-0.5">
                <MetricRow icon={Eye} label="Visualizações" value={story.views || 0} />
                <MetricRow icon={Target} label="Alcance" value={story.reach || 0} />
                <MetricRow icon={Heart} label="Interações" value={story.interactions || 0} />
                <MetricRow icon={MessageCircle} label="Respostas" value={story.replies || 0} />
                <MetricRow icon={Share2} label="Compartilhamentos" value={story.shares || 0} />
                {story.retention_rate !== null && (
                  <MetricRow icon={Eye} label="Retenção" value={`${story.retention_rate?.toFixed(1)}%`} />
                )}
                <div className="pt-2 border-t border-border/30 mt-2">
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      <span>Avançar: {formatNumber(story.forward_taps)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ArrowLeft className="h-3 w-3" />
                      <span>Voltar: {formatNumber(story.back_taps)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      <span>Próximo: {formatNumber(story.next_story_taps)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <LogOut className="h-3 w-3" />
                      <span>Sair: {formatNumber(story.exit_taps)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}