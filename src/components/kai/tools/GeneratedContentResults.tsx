import { useState } from "react";
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Calendar, 
  BookmarkPlus,
  Scissors,
  Star,
  FileText,
  MessageSquare,
  Mail,
  Linkedin,
  Instagram,
  Film,
  PenTool,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ContentFormat, ContentObjective, GeneratedContent, CutMoment } from "@/hooks/useContentRepurpose";
import { cn } from "@/lib/utils";

interface GeneratedContentResultsProps {
  contents: GeneratedContent[];
  videoTitle: string;
  videoThumbnail?: string;
  onBack: () => void;
  onCopy: (text: string) => Promise<void>;
  onReset: () => void;
  clientName?: string;
}

const FORMAT_CONFIG: Record<ContentFormat, { 
  icon: React.ComponentType<any>; 
  label: string; 
  color: string;
  gradient: string;
}> = {
  newsletter: { 
    icon: Mail, 
    label: "Newsletter", 
    color: "text-blue-500",
    gradient: "from-blue-500/20 to-blue-600/10"
  },
  thread: { 
    icon: MessageSquare, 
    label: "Thread", 
    color: "text-sky-500",
    gradient: "from-sky-500/20 to-sky-600/10"
  },
  tweet: { 
    icon: Send, 
    label: "Tweet", 
    color: "text-sky-400",
    gradient: "from-sky-400/20 to-sky-500/10"
  },
  carousel: { 
    icon: Film, 
    label: "Carrossel", 
    color: "text-pink-500",
    gradient: "from-pink-500/20 to-pink-600/10"
  },
  linkedin_post: { 
    icon: Linkedin, 
    label: "LinkedIn", 
    color: "text-blue-600",
    gradient: "from-blue-600/20 to-blue-700/10"
  },
  instagram_post: { 
    icon: Instagram, 
    label: "Instagram", 
    color: "text-purple-500",
    gradient: "from-purple-500/20 to-purple-600/10"
  },
  reels_script: { 
    icon: Film, 
    label: "Roteiro Reels", 
    color: "text-rose-500",
    gradient: "from-rose-500/20 to-rose-600/10"
  },
  blog_post: { 
    icon: FileText, 
    label: "Blog Post", 
    color: "text-emerald-500",
    gradient: "from-emerald-500/20 to-emerald-600/10"
  },
  email_marketing: { 
    icon: Mail, 
    label: "Email Marketing", 
    color: "text-amber-500",
    gradient: "from-amber-500/20 to-amber-600/10"
  },
  cut_moments: { 
    icon: Scissors, 
    label: "Momentos de Corte", 
    color: "text-red-500",
    gradient: "from-red-500/20 to-red-600/10"
  },
};

const OBJECTIVE_CONFIG: Record<ContentObjective, { label: string; color: string }> = {
  sales: { label: "Vendas", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  lead_generation: { label: "Geração de Leads", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  educational: { label: "Educacional", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  brand_awareness: { label: "Fortalecimento de Marca", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

const CutMomentCard = ({ moment, index }: { moment: CutMoment; index: number }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      `${moment.title}\n\nTimestamp: ${moment.timestamp}\n${moment.description}\n\nHook: ${moment.hook}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado!" });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-orange-500";
  };

  return (
    <Card className={cn(
      "border transition-all hover:border-primary/30",
      index === 0 && "ring-2 ring-green-500/30 border-green-500/30"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              "text-2xl font-bold",
              getScoreColor(moment.score)
            )}>
              {moment.score}
            </div>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={cn(
                    "h-3 w-3",
                    i < Math.ceil(moment.score / 20) 
                      ? "fill-yellow-400 text-yellow-400" 
                      : "text-muted-foreground/30"
                  )} 
                />
              ))}
            </div>
            {index === 0 && (
              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30 mt-1">
                TOP 1
              </Badge>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs font-mono">
                {moment.timestamp}
              </Badge>
              <h4 className="font-semibold truncate">{moment.title}</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{moment.description}</p>
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="text-muted-foreground">Hook: </span>
              <span className="font-medium">{moment.hook}</span>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const ContentResultCard = ({ 
  content, 
  onCopy 
}: { 
  content: GeneratedContent; 
  onCopy: (text: string) => Promise<void>;
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  
  const config = FORMAT_CONFIG[content.format];
  const objectiveConfig = OBJECTIVE_CONFIG[content.objective];
  const Icon = config.icon;

  const handleCopy = async () => {
    await onCopy(content.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Conteúdo copiado!" });
  };

  // For cut moments, render special view
  if (content.format === "cut_moments" && content.cutMoments) {
    return (
      <Card className={cn("overflow-hidden", `bg-gradient-to-br ${config.gradient}`)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-background/80", config.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{config.label}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {content.cutMoments.length} momentos identificados
                </p>
              </div>
            </div>
            <Badge variant="outline" className={objectiveConfig.color}>
              {objectiveConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {content.cutMoments.map((moment, index) => (
            <CutMomentCard key={index} moment={moment} index={index} />
          ))}
        </CardContent>
      </Card>
    );
  }

  const previewLength = 300;
  const showExpandButton = content.content.length > previewLength;
  const displayContent = expanded ? content.content : content.content.substring(0, previewLength);

  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-md", `bg-gradient-to-br ${config.gradient}`)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-background/80", config.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">{config.label}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={objectiveConfig.color}>
              {objectiveConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-background/60 rounded-lg p-4 backdrop-blur-sm">
          <ScrollArea className={cn(expanded ? "max-h-96" : "max-h-48")}>
            <div className="whitespace-pre-wrap text-sm">
              {displayContent}
              {!expanded && showExpandButton && "..."}
            </div>
          </ScrollArea>
          {showExpandButton && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Ver menos" : "Ver mais"}
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {new Date(content.generatedAt).toLocaleTimeString("pt-BR")}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Planejar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <BookmarkPlus className="h-3.5 w-3.5" />
              Salvar
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="gap-1.5"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function GeneratedContentResults({
  contents,
  videoTitle,
  videoThumbnail,
  onBack,
  onCopy,
  onReset,
  clientName,
}: GeneratedContentResultsProps) {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Conteúdos Gerados</h1>
            <p className="text-muted-foreground">
              {contents.length} conteúdo{contents.length !== 1 ? 's' : ''} criado{contents.length !== 1 ? 's' : ''}
              {clientName && ` para ${clientName}`}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onReset}>
          Novo Vídeo
        </Button>
      </div>

      {/* Video Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {videoThumbnail && (
              <img 
                src={videoThumbnail} 
                alt={videoTitle}
                className="w-32 h-20 object-cover rounded-lg"
              />
            )}
            <div>
              <p className="font-medium">{videoTitle}</p>
              <p className="text-sm text-muted-foreground">Vídeo fonte</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid gap-4">
        {contents.map((content, index) => (
          <ContentResultCard 
            key={`${content.format}-${index}`}
            content={content}
            onCopy={onCopy}
          />
        ))}
      </div>
    </div>
  );
}
