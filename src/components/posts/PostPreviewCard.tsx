import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Edit2, 
  Check, 
  X, 
  Twitter, 
  Instagram, 
  Linkedin,
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  MoreHorizontal,
  ThumbsUp,
  Send,
  Bookmark
} from "lucide-react";
import { toPng } from "html-to-image";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type PostPlatform = "twitter" | "instagram" | "linkedin";

interface PostPreviewCardProps {
  content: string;
  platform: PostPlatform;
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string;
  imageUrl?: string;
  onContentChange?: (content: string) => void;
  className?: string;
}

const platformConfig = {
  twitter: {
    name: "Twitter/X",
    icon: Twitter,
    bgClass: "bg-card",
    borderClass: "border-border",
    maxChars: 280,
    accentColor: "hsl(var(--primary))",
  },
  instagram: {
    name: "Instagram",
    icon: Instagram,
    bgClass: "bg-card",
    borderClass: "border-border",
    maxChars: 2200,
    accentColor: "hsl(var(--primary))",
  },
  linkedin: {
    name: "LinkedIn",
    icon: Linkedin,
    bgClass: "bg-card",
    borderClass: "border-border",
    maxChars: 3000,
    accentColor: "hsl(var(--primary))",
  },
};

export const PostPreviewCard = ({
  content,
  platform,
  authorName = "Seu Nome",
  authorHandle = "@seuhandle",
  authorAvatar,
  imageUrl,
  onContentChange,
  className,
}: PostPreviewCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const config = platformConfig[platform];
  const Icon = config.icon;

  const handleSave = () => {
    if (onContentChange) {
      onContentChange(editedContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  const handleExportPng = async () => {
    if (!cardRef.current) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `post-${platform}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast({ description: "Imagem exportada com sucesso!" });
    } catch (error) {
      toast({ description: "Erro ao exportar imagem", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const renderTwitterPost = () => (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={authorAvatar} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold text-sm text-foreground">{authorName}</span>
            <span className="text-muted-foreground text-sm">{authorHandle}</span>
            <span className="text-muted-foreground text-sm">· agora</span>
          </div>
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="mt-2 min-h-[80px] text-sm resize-none"
              maxLength={config.maxChars}
            />
          ) : (
            <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{content}</p>
          )}
          {imageUrl && !isEditing && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border">
              <img src={imageUrl} alt="Post" className="w-full h-auto" />
            </div>
          )}
          <div className="flex items-center justify-between mt-3 text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">12</span>
            </button>
            <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
              <Repeat2 className="h-4 w-4" />
              <span className="text-xs">45</span>
            </button>
            <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
              <Heart className="h-4 w-4" />
              <span className="text-xs">128</span>
            </button>
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <Share className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInstagramPost = () => (
    <div>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 ring-2 ring-primary/20">
            <AvatarImage src={authorAvatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm text-foreground">{authorHandle.replace("@", "")}</span>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </div>
      {imageUrl && !isEditing && (
        <div className="aspect-square bg-muted">
          <img src={imageUrl} alt="Post" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Heart className="h-6 w-6 text-foreground hover:text-red-500 cursor-pointer transition-colors" />
            <MessageCircle className="h-6 w-6 text-foreground cursor-pointer" />
            <Send className="h-6 w-6 text-foreground cursor-pointer" />
          </div>
          <Bookmark className="h-6 w-6 text-foreground cursor-pointer" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">1.234 curtidas</p>
        {isEditing ? (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[80px] text-sm resize-none"
            maxLength={config.maxChars}
          />
        ) : (
          <p className="text-sm text-foreground">
            <span className="font-semibold">{authorHandle.replace("@", "")} </span>
            {content}
          </p>
        )}
      </div>
    </div>
  );

  const renderLinkedInPost = () => (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={authorAvatar} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold text-sm text-foreground">{authorName}</p>
          <p className="text-xs text-muted-foreground">Cargo • Empresa</p>
          <p className="text-xs text-muted-foreground">agora • 🌐</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </div>
      {isEditing ? (
        <Textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="mt-3 min-h-[100px] text-sm resize-none"
          maxLength={config.maxChars}
        />
      ) : (
        <p className="text-sm text-foreground mt-3 whitespace-pre-wrap">{content}</p>
      )}
      {imageUrl && !isEditing && (
        <div className="mt-3 rounded-lg overflow-hidden border border-border">
          <img src={imageUrl} alt="Post" className="w-full h-auto" />
        </div>
      )}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
        <div className="flex -space-x-1">
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
            <ThumbsUp className="h-2.5 w-2.5 text-white" />
          </div>
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <Heart className="h-2.5 w-2.5 text-white" />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">234 • 18 comentários</span>
      </div>
      <div className="flex items-center justify-around mt-3 pt-2 border-t border-border text-muted-foreground">
        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ThumbsUp className="h-4 w-4" />
          <span className="text-xs font-medium">Gostei</span>
        </button>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs font-medium">Comentar</span>
        </button>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
          <Repeat2 className="h-4 w-4" />
          <span className="text-xs font-medium">Repostar</span>
        </button>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
          <Send className="h-4 w-4" />
          <span className="text-xs font-medium">Enviar</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn("relative group", className)}>
      {/* Toolbar */}
      <div className="absolute -top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Badge variant="secondary" className="text-[10px] h-5 gap-1">
          <Icon className="h-3 w-3" />
          {config.name}
        </Badge>
        {isEditing ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleSave}
            >
              <Check className="h-3.5 w-3.5 text-green-500" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleCancel}
            >
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleExportPng}
              disabled={isExporting}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className={cn(
          "rounded-xl border overflow-hidden shadow-sm",
          config.bgClass,
          config.borderClass
        )}
      >
        {platform === "twitter" && renderTwitterPost()}
        {platform === "instagram" && renderInstagramPost()}
        {platform === "linkedin" && renderLinkedInPost()}
      </div>

      {/* Character count */}
      {isEditing && (
        <div className="mt-1 text-right">
          <span className={cn(
            "text-xs",
            editedContent.length > config.maxChars ? "text-destructive" : "text-muted-foreground"
          )}>
            {editedContent.length}/{config.maxChars}
          </span>
        </div>
      )}
    </div>
  );
};
