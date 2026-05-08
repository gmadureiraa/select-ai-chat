// TopViralContentCard — top 5 conteúdos do cliente atual ranqueados por engagement.
// Aparece no HomeDashboard quando há cliente selecionado (e tem dado).
// Empty state instrui o user a importar histórico em Configurações > Library.

import { motion } from "framer-motion";
import { Trophy, Heart, ExternalLink, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTopViralContent } from "@/hooks/useTopViralContent";

interface TopViralContentCardProps {
  clientId?: string | null;
  limit?: number;
  onNavigate?: (tab: string) => void;
  onItemClick?: (id: string) => void;
}

function shortText(text: string | null | undefined, max = 80) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function formatScore(score: number | null | undefined) {
  if (!score || score < 1) return "—";
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`;
  return Math.round(score).toString();
}

export function TopViralContentCard({
  clientId,
  limit = 5,
  onNavigate,
  onItemClick,
}: TopViralContentCardProps) {
  const { data, isLoading } = useTopViralContent({ clientId, limit });

  if (!clientId) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500/80" />
            Top conteúdo do cliente
            {data && data.length > 0 && (
              <span className="text-[11px] font-normal text-muted-foreground ml-1">
                ({data.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <Skeleton className="h-5 w-5 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Sem conteúdo histórico desse cliente
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 max-w-[280px] mx-auto">
                Importe conteúdo histórico em{" "}
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => onNavigate?.("settings")}
                >
                  Configurações &gt; Library
                </button>{" "}
                pra ver o ranking aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.map((row) => {
                const url =
                  (row.metadata?.url as string | undefined) ||
                  (row.metadata?.permalink as string | undefined) ||
                  (row.metadata?.link as string | undefined);
                const platform = row.metadata?.platform as string | undefined;
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded-md transition-colors",
                      onItemClick || url
                        ? "hover:bg-muted/30 cursor-pointer"
                        : "",
                    )}
                    onClick={() => {
                      if (onItemClick) onItemClick(row.id);
                      else if (url) window.open(url, "_blank", "noopener");
                    }}
                  >
                    <div className="h-5 w-5 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center text-[10px] font-semibold shrink-0">
                      {row.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug line-clamp-2">
                        {row.title || shortText(row.content) || "Sem título"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {platform && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 capitalize"
                          >
                            {platform}
                          </Badge>
                        )}
                        {row.content_type && (
                          <span className="text-[10px] text-muted-foreground/60">
                            {row.content_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Heart className="h-3 w-3" />
                      <span className="tabular-nums">
                        {formatScore(row.engagement_score)}
                      </span>
                      {url && <ExternalLink className="h-3 w-3 ml-1 opacity-50" />}
                    </div>
                  </div>
                );
              })}
              {onNavigate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onNavigate("library")}
                >
                  Ver biblioteca completa
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
