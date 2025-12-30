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
  MoreHorizontal
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

  // Simple content preview without social metrics
  const renderContent = () => (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar className={cn(
          "flex-shrink-0",
          platform === "linkedin" ? "h-12 w-12" : "h-10 w-10",
          platform === "instagram" && "ring-2 ring-primary/20"
        )}>
          <AvatarImage src={authorAvatar} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold text-sm text-foreground">{authorName}</span>
            {platform !== "linkedin" && (
              <span className="text-muted-foreground text-sm">{authorHandle}</span>
            )}
            {platform === "linkedin" && (
              <span className="text-xs text-muted-foreground">• Cargo</span>
            )}
          </div>
          {platform === "linkedin" && (
            <p className="text-xs text-muted-foreground">agora • 🌐</p>
          )}
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
            <div className="mt-3 rounded-xl overflow-hidden border border-border">
              <img src={imageUrl} alt="Post" className="w-full h-auto" />
            </div>
          )}
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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
        {renderContent()}
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
