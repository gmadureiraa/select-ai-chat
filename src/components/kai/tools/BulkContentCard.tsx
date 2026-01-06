import { useState } from "react";
import { 
  Copy, 
  Check, 
  Send, 
  Trash2, 
  Loader2,
  CheckCircle2,
  MessageSquare, 
  Mail, 
  FileText, 
  Linkedin, 
  Instagram, 
  Film,
  Scissors,
  Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ContentFormat } from "@/hooks/useContentCreator";
import { BulkContentItem } from "@/hooks/useBulkContentCreator";

const FORMAT_CONFIG: Record<ContentFormat, { 
  icon: React.ComponentType<any>; 
  label: string; 
  color: string;
  gradient: string;
}> = {
  tweet: { icon: Send, label: "Tweet", color: "text-sky-400", gradient: "from-sky-400/10 to-sky-500/5" },
  thread: { icon: MessageSquare, label: "Thread", color: "text-sky-500", gradient: "from-sky-500/10 to-sky-600/5" },
  instagram_post: { icon: Instagram, label: "Instagram", color: "text-pink-500", gradient: "from-pink-500/10 to-pink-600/5" },
  reels_script: { icon: Film, label: "Reels", color: "text-rose-500", gradient: "from-rose-500/10 to-rose-600/5" },
  carousel: { icon: Film, label: "Carrossel", color: "text-purple-500", gradient: "from-purple-500/10 to-purple-600/5" },
  linkedin_post: { icon: Linkedin, label: "LinkedIn", color: "text-blue-600", gradient: "from-blue-600/10 to-blue-700/5" },
  newsletter: { icon: Mail, label: "Newsletter", color: "text-blue-500", gradient: "from-blue-500/10 to-blue-600/5" },
  blog_post: { icon: FileText, label: "Blog", color: "text-emerald-500", gradient: "from-emerald-500/10 to-emerald-600/5" },
  email_marketing: { icon: Megaphone, label: "Email Mkt", color: "text-amber-500", gradient: "from-amber-500/10 to-amber-600/5" },
  cut_moments: { icon: Scissors, label: "Cortes", color: "text-red-500", gradient: "from-red-500/10 to-red-600/5" },
};

interface BulkContentCardProps {
  item: BulkContentItem;
  onCopy: (text: string) => void;
  onSendToPlanning: (itemId: string) => void;
  onDiscard: (itemId: string) => void;
}

export function BulkContentCard({
  item,
  onCopy,
  onSendToPlanning,
  onDiscard,
}: BulkContentCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  
  const config = FORMAT_CONFIG[item.format];
  const Icon = config.icon;

  const handleCopy = () => {
    onCopy(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Conteúdo copiado!" });
  };

  // Pending/Generating state
  if (item.status === 'pending' || item.status === 'generating') {
    return (
      <Card className={cn("overflow-hidden", `bg-gradient-to-br ${config.gradient}`)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-background/80", config.color)}>
              {item.status === 'generating' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 opacity-50" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config.label} #{item.index + 1}</span>
                <Badge variant="outline" className="text-xs">
                  {item.status === 'generating' ? 'Gerando...' : 'Aguardando'}
                </Badge>
              </div>
              {item.status === 'generating' && (
                <div className="mt-2 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (item.status === 'error') {
    return (
      <Card className={cn("overflow-hidden border-destructive/50", `bg-gradient-to-br ${config.gradient}`)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-background/80", config.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium">{config.label} #{item.index + 1}</span>
              <p className="text-xs text-destructive mt-1">Erro: {item.error}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onDiscard(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Done state
  const previewLength = 200;
  const showExpandButton = item.content.length > previewLength;
  const displayContent = expanded ? item.content : item.content.substring(0, previewLength);

  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-md", `bg-gradient-to-br ${config.gradient}`)}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg bg-background/80", config.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{config.label} #{item.index + 1}</span>
            {item.addedToPlanning && (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                No planejamento
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            {!item.addedToPlanning && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSendToPlanning(item.id)}>
                <Send className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDiscard(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-background/60 rounded-lg p-3 backdrop-blur-sm">
          <ScrollArea className={cn(expanded ? "max-h-64" : "max-h-24")}>
            <div className="whitespace-pre-wrap text-sm">
              {displayContent}
              {!expanded && showExpandButton && "..."}
            </div>
          </ScrollArea>
          {showExpandButton && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 h-7 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Ver menos" : "Ver mais"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
