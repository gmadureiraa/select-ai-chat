import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, AlertCircle, CheckCircle2, Clock } from "lucide-react";
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
        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 gap-1">
          <AlertCircle className="h-3 w-3" />
          Sem dados
        </Badge>
      );
    }

    const isStale = lastUpdate && new Date(lastUpdate) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    if (isStale) {
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 gap-1">
          <Clock className="h-3 w-3" />
          Desatualizado
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-green-500 border-green-500/30 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {daysOfData} {daysOfData === 1 ? 'dia' : 'dias'}
      </Badge>
    );
  };

  const getLastUpdateText = () => {
    if (!lastUpdate) return null;
    
    try {
      return `Atualizado ${formatDistanceToNow(new Date(lastUpdate), { 
        addSuffix: true, 
        locale: ptBR 
      })}`;
    } catch {
      return null;
    }
  };

  return (
    <Card
      className={`border-border/50 bg-card/50 hover:border-border transition-all cursor-pointer group relative ${
        isArchived ? 'opacity-60' : ''
      } ${!hasData ? 'border-dashed' : ''}`}
    >
      {/* Archive/Restore button */}
      {!isArchived && onArchive && (
        <div 
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onArchive}
            title="Arquivar canal"
          >
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      )}

      {isArchived && onRestore && (
        <div 
          className="absolute top-2 right-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onRestore}
          >
            Restaurar
          </Button>
        </div>
      )}

      <div onClick={onClick}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <CardDescription className="text-sm">{description}</CardDescription>
          {lastUpdate && (
            <p className="text-xs text-muted-foreground">
              {getLastUpdateText()}
            </p>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
