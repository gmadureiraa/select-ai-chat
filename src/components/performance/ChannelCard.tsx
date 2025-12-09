import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, AlertCircle, CheckCircle2, Clock, ChevronRight, Instagram, Youtube, Twitter, Newspaper, Video } from "lucide-react";
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

// Channel color/style mapping
const channelStyles: Record<string, { bg: string; iconColor: string; borderColor: string }> = {
  instagram: {
    bg: "from-pink-500/10 to-purple-500/10",
    iconColor: "text-pink-500",
    borderColor: "hover:border-pink-500/50",
  },
  youtube: {
    bg: "from-red-500/10 to-red-600/10",
    iconColor: "text-red-500",
    borderColor: "hover:border-red-500/50",
  },
  twitter: {
    bg: "from-sky-500/10 to-blue-500/10",
    iconColor: "text-sky-500",
    borderColor: "hover:border-sky-500/50",
  },
  newsletter: {
    bg: "from-emerald-500/10 to-green-500/10",
    iconColor: "text-emerald-500",
    borderColor: "hover:border-emerald-500/50",
  },
  tiktok: {
    bg: "from-slate-500/10 to-slate-600/10",
    iconColor: "text-foreground",
    borderColor: "hover:border-slate-500/50",
  },
};

const channelIcons: Record<string, LucideIcon> = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  newsletter: Newspaper,
  tiktok: Video,
};

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
  const style = channelStyles[channelKey] || {
    bg: "from-muted to-muted",
    iconColor: "text-muted-foreground",
    borderColor: "hover:border-border",
  };
  
  const ChannelIcon = channelIcons[channelKey] || Icon;

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
        {daysOfData}d de dados
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
      className={`border-border/50 ${style.borderColor} transition-all cursor-pointer group relative overflow-hidden ${
        isArchived ? 'opacity-60' : ''
      } ${!hasData ? 'border-dashed' : ''}`}
      onClick={onClick}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${style.bg} opacity-50`} />
      
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

      <CardContent className="p-5 relative">
        {/* Icon prominente */}
        <div className="flex flex-col items-center text-center mb-3">
          <div className={`h-14 w-14 rounded-2xl bg-background/80 backdrop-blur-sm flex items-center justify-center mb-3 shadow-sm border border-border/30`}>
            <ChannelIcon className={`h-7 w-7 ${style.iconColor}`} />
          </div>
          <h3 className="font-semibold text-base">{title}</h3>
        </div>
        
        {/* Status */}
        <div className="flex flex-col items-center gap-2">
          {getStatusBadge()}
          {lastUpdate && (
            <p className="text-[10px] text-muted-foreground">
              {getLastUpdateText()}
            </p>
          )}
        </div>
        
        {/* Hover indicator */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
