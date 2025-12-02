import { memo, useState } from "react";
import { Globe, ExternalLink, Loader2, Twitter, Instagram, Linkedin } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResearchItems, ResearchItem } from "@/hooks/useResearchItems";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EmbedNodeProps {
  id: string;
  data: {
    item: ResearchItem;
    onDelete: (id: string) => void;
    projectId: string;
    isConnected?: boolean;
  };
}

type EmbedType = "twitter" | "instagram" | "linkedin" | "unknown";

const detectEmbedType = (url: string): EmbedType => {
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("linkedin.com")) return "linkedin";
  return "unknown";
};

const embedTypeConfig: Record<EmbedType, { icon: typeof Twitter; color: string; bgColor: string; label: string }> = {
  twitter: { icon: Twitter, color: "text-sky-500", bgColor: "bg-sky-500/10", label: "Twitter/X" },
  instagram: { icon: Instagram, color: "text-pink-500", bgColor: "bg-pink-500/10", label: "Instagram" },
  linkedin: { icon: Linkedin, color: "text-blue-600", bgColor: "bg-blue-600/10", label: "LinkedIn" },
  unknown: { icon: Globe, color: "text-emerald-500", bgColor: "bg-emerald-500/10", label: "Embed" },
};

export const EmbedNode = memo(({ id, data }: EmbedNodeProps) => {
  const { item, onDelete, projectId, isConnected } = data;
  const { updateItem } = useResearchItems(projectId);
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const embedType = item.source_url ? detectEmbedType(item.source_url) : "unknown";
  const config = embedTypeConfig[embedType];

  const handleSubmit = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    try {
      const detectedType = detectEmbedType(url);
      
      // Try to extract content from the embed
      toast({ title: "Extraindo conteúdo...", description: "Processando post da rede social." });
      
      let extractedContent = "";
      let extractedTitle = "";
      let thumbnail = "";

      if (detectedType === "instagram") {
        // Use extract-instagram for Instagram posts
        const { data: instaData, error } = await supabase.functions.invoke("extract-instagram", {
          body: { url },
        });
        
        if (!error && instaData) {
          extractedContent = instaData.caption || "";
          extractedTitle = `Instagram - ${instaData.ownerUsername || "Post"}`;
          thumbnail = instaData.images?.[0] || "";
        }
      } else {
        // Use generic scraper for other platforms
        const { data: scrapeData, error } = await supabase.functions.invoke("scrape-research-link", {
          body: { url },
        });
        
        if (!error && scrapeData?.data) {
          extractedContent = scrapeData.data.content || "";
          extractedTitle = scrapeData.data.title || url;
          thumbnail = scrapeData.data.thumbnail || "";
        }
      }

      await updateItem.mutateAsync({
        id,
        title: extractedTitle || `${config.label} Post`,
        source_url: url,
        content: extractedContent,
        thumbnail_url: thumbnail,
        metadata: {
          embedType: detectedType,
          extractedAt: new Date().toISOString(),
        },
        processed: true,
      });

      toast({ title: "Embed adicionado", description: "Conteúdo extraído com sucesso." });
      setUrl("");
    } catch (error: any) {
      console.error("Embed error:", error);
      toast({
        title: "Erro ao processar embed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasContent = item.source_url && item.processed;
  const Icon = config.icon;

  return (
    <BaseNode
      id={id}
      onDelete={onDelete}
      icon={Icon}
      iconColor={config.color}
      bgColor={config.bgColor}
      borderColor={cn("border-emerald-500/30", {
        "border-sky-500/30": embedType === "twitter",
        "border-pink-500/30": embedType === "instagram",
        "border-blue-600/30": embedType === "linkedin",
      })}
      label={config.label}
      title={item.title || "Embed de Rede Social"}
      isConnected={isConnected}
      className="w-80"
    >
      {!hasContent ? (
        <div className="space-y-2">
          <Input
            placeholder="Cole a URL do post (Twitter, Instagram, LinkedIn)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={isLoading}
            className="text-sm no-pan no-wheel"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isLoading || !url.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Adicionar"
              )}
            </Button>
          </div>
          <div className="flex gap-1 justify-center">
            <Twitter className="h-3 w-3 text-muted-foreground" />
            <Instagram className="h-3 w-3 text-muted-foreground" />
            <Linkedin className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {item.thumbnail_url && (
            <div className="relative rounded-md overflow-hidden bg-muted aspect-video">
              <img
                src={item.thumbnail_url}
                alt={item.title || "Embed preview"}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {item.content && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {item.content.slice(0, 150)}...
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.open(item.source_url!, "_blank")}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            Abrir original
          </Button>
        </div>
      )}
    </BaseNode>
  );
});

EmbedNode.displayName = "EmbedNode";
