import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Eye, Heart, MessageCircle, Bookmark, Library as LibraryIcon, Lightbulb, Film, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type LibraryIdea = {
  id: string;
  title: string;
  category: string | null;
  hook: string | null;
  description: string | null;
  source_url: string | null;
  source_handle: string | null;
  tags: string[] | null;
  created_at: string;
};

type LibraryReel = {
  id: string;
  title: string | null;
  caption: string | null;
  source_url: string;
  thumbnail_url: string | null;
  video_url: string | null;
  author_handle: string | null;
  author_followers: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  posted_at: string | null;
  duration_seconds: number | null;
  category: string | null;
  tags: string[] | null;
  hooks: string[] | null;
  metrics: Record<string, unknown> | null;
  created_at: string;
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function IdeaCard({ idea }: { idea: LibraryIdea }) {
  return (
    <Card className="p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          {idea.category && (
            <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
              {idea.category}
            </Badge>
          )}
          <h3 className="font-medium text-sm leading-snug">{idea.title}</h3>
        </div>
      </div>

      {idea.hook && (
        <p className="text-xs text-foreground/80 italic leading-relaxed border-l-2 border-primary/40 pl-2">
          “{idea.hook}”
        </p>
      )}

      {idea.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {idea.description}
        </p>
      )}

      {idea.tags && idea.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {idea.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {idea.source_url && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-fit -ml-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <a href={idea.source_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1.5" />
            {idea.source_handle || "fonte"}
          </a>
        </Button>
      )}
    </Card>
  );
}

function ReelCard({ reel }: { reel: LibraryReel }) {
  return (
    <Card className="overflow-hidden flex flex-col hover:border-primary/40 transition-colors">
      {/* Thumbnail */}
      <a
        href={reel.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative aspect-[9/16] bg-muted overflow-hidden group"
      >
        {reel.thumbnail_url ? (
          <img
            src={reel.thumbnail_url}
            alt={reel.title || "Reel"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Film className="h-12 w-12" strokeWidth={1.2} />
          </div>
        )}
        {reel.views != null && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatNumber(reel.views)}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Abrir no Instagram
          <ExternalLink className="inline h-3 w-3 ml-1" />
        </div>
      </a>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {reel.author_handle && (
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium truncate">@{reel.author_handle}</span>
            {reel.author_followers != null && (
              <span className="text-muted-foreground">{formatNumber(reel.author_followers)}</span>
            )}
          </div>
        )}

        {reel.title && (
          <p className="text-xs font-medium line-clamp-2 leading-snug">{reel.title}</p>
        )}

        {reel.caption && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {reel.caption}
          </p>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-1.5 border-t border-border/50">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" /> {formatNumber(reel.likes)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" /> {formatNumber(reel.comments)}
          </span>
          {reel.saves != null && (
            <span className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" /> {formatNumber(reel.saves)}
            </span>
          )}
        </div>

        {reel.category && (
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">
            {reel.category}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-muted-foreground/40 mb-4">{icon}</div>
      <h3 className="font-medium text-base mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

export function ViralLibraryTab() {
  const isMobile = useIsMobile();

  const ideasQuery = useQuery({
    queryKey: ["library_ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_ideas" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as LibraryIdea[];
    },
  });

  const reelsQuery = useQuery({
    queryKey: ["library_reels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_reels" as never)
        .select("*")
        .order("views", { ascending: false, nullsFirst: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as LibraryReel[];
    },
  });

  return (
    <div className={cn("h-full overflow-auto", isMobile ? "p-3" : "p-6")}>
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <LibraryIcon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold">Biblioteca Viral</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Curadoria global de ideias e reels para alimentar a produção de conteúdo. Acessível para todos os workspaces.
          </p>
        </div>

        <Tabs defaultValue="ideas" className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="ideas" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Ideias
              {ideasQuery.data && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {ideasQuery.data.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reels" className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              Reels
              {reelsQuery.data && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {reelsQuery.data.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ideas" className="mt-0">
            {ideasQuery.isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ideasQuery.isError ? (
              <EmptyState
                icon={<Lightbulb className="h-12 w-12" strokeWidth={1.2} />}
                title="Erro ao carregar ideias"
                description={(ideasQuery.error as Error)?.message ?? "Tenta de novo daqui a pouco."}
              />
            ) : !ideasQuery.data || ideasQuery.data.length === 0 ? (
              <EmptyState
                icon={<Lightbulb className="h-12 w-12" strokeWidth={1.2} />}
                title="Nenhuma ideia ainda"
                description="As Kaleidos 100 vão aparecer aqui assim que importarmos do Notion."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ideasQuery.data.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reels" className="mt-0">
            {reelsQuery.isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : reelsQuery.isError ? (
              <EmptyState
                icon={<Film className="h-12 w-12" strokeWidth={1.2} />}
                title="Erro ao carregar reels"
                description={(reelsQuery.error as Error)?.message ?? "Tenta de novo daqui a pouco."}
              />
            ) : !reelsQuery.data || reelsQuery.data.length === 0 ? (
              <EmptyState
                icon={<Film className="h-12 w-12" strokeWidth={1.2} />}
                title="Nenhum reel curado ainda"
                description="A curadoria global de reels virais aparece aqui. Em breve."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {reelsQuery.data.map((reel) => (
                  <ReelCard key={reel.id} reel={reel} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
