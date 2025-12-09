import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, AlertCircle, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChannelCardProps {
  channelKey: string;
  icon: LucideIcon;
  title: string;
  description: string;
  hasData: boolean;
  daysOfData: number;
  lastUpdate: string | null;
  isArchived?: boolean;
  onClick: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}

export function ChannelCard({
  channelKey,
  icon: Icon,
  title,
  description,
  hasData,
  daysOfData,
  lastUpdate,
  isArchived = false,
  onClick,
  onArchive,
  onRestore,
}: ChannelCardProps) {
  const getStatusBadge = () => {
    if (!hasData) {
      return (
        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1 text-[10px]">
          <AlertCircle className="h-3 w-3" />
          Sem dados
        </Badge>
      );
    }

    const isStale = lastUpdate && new Date(lastUpdate) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    if (isStale) {
      return (
        <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1 text-[10px]">
          <Clock className="h-3 w-3" />
          Desatualizado
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" />
        {daysOfData}d
      </Badge>
    );
  };

  const getLastUpdateText = () => {
    if (!lastUpdate) return null;
    
    try {
      return formatDistanceToNow(new Date(lastUpdate), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return null;
    }
  };

  return (
    <Card
      className={`border-border/50 hover:border-border hover:bg-muted/30 transition-all cursor-pointer group relative ${
        isArchived ? 'opacity-60' : ''
      } ${!hasData ? 'border-dashed' : ''}`}
      onClick={onClick}
    >
      {/* Archive/Restore button */}
      {!isArchived && onArchive && (
        <div 
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Arquivar canal"
          >
            <Archive className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      )}

      {isArchived && onRestore && (
        <div 
          className="absolute top-2 right-2 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
          >
            Restaurar
          </Button>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium truncate">{title}</CardTitle>
              {getStatusBadge()}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-xs line-clamp-1 mb-2">{description}</CardDescription>
        <div className="flex items-center justify-between">
          {lastUpdate ? (
            <p className="text-[10px] text-muted-foreground">
              {getLastUpdateText()}
            </p>
          ) : (
            <span />
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}
