import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Mail,
  Eye,
  MousePointer,
  Users,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Rss,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface NewsletterContentDialogProps {
  newsletter: {
    id: string;
    title: string;
    content: string;
    content_url?: string | null;
    thumbnail_url?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  metrics?: {
    views?: number | null;
    open_rate?: number | null;
    click_rate?: number | null;
    subscribers?: number | null;
    metric_date?: string;
    metadata?: Record<string, unknown> | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getStorageUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("client-files").getPublicUrl(path);
  return data.publicUrl;
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string | null | undefined;
  suffix?: string;
}) => (
  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-lg">
    <Icon className="h-4 w-4 text-muted-foreground mb-1" />
    <span className="text-lg font-semibold">
      {value != null ? (
        <>
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
          {suffix}
        </>
      ) : (
        "-"
      )}
    </span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

export const NewsletterContentDialog = ({
  newsletter,
  metrics,
  open,
  onOpenChange,
}: NewsletterContentDialogProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!newsletter) return null;

  // Get images from metadata
  const images: string[] = [];
  const metadataImages = (newsletter.metadata as any)?.images;
  if (Array.isArray(metadataImages)) {
    metadataImages.forEach((path: string) => {
      if (typeof path === "string") {
        images.push(getStorageUrl(path));
      }
    });
  } else if (newsletter.thumbnail_url) {
    images.push(getStorageUrl(newsletter.thumbnail_url));
  }

  const hasMultipleImages = images.length > 1;

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const copyContent = async () => {
    if (newsletter.content) {
      await navigator.clipboard.writeText(newsletter.content);
      setCopied(true);
      toast.success("Conteúdo copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const metricDate = metrics?.metric_date || (newsletter.metadata as any)?.metric_date;
  const delivered = (metrics?.metadata as any)?.delivered || metrics?.views || 0;
  const opens = (metrics?.metadata as any)?.opens || 0;
  const clicks = (metrics?.metadata as any)?.clicks || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-500" />
                {newsletter.title}
              </DialogTitle>
              {(newsletter.metadata as any)?.rss_synced && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Rss className="h-3 w-3" />
                  RSS
                </Badge>
              )}
            </div>
            {metricDate && (
              <span className="text-sm text-muted-foreground">
                {format(parseISO(metricDate), "d 'de' MMMM, yyyy", { locale: ptBR })}
              </span>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-4 pt-2 space-y-4">
            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <img
                  src={images[currentImageIndex]}
                  alt={`Imagem ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />

                {hasMultipleImages && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                      onClick={handlePrevImage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                      onClick={handleNextImage}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {images.map((_, idx) => (
                        <button
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx === currentImageIndex ? "bg-white" : "bg-white/50"
                          }`}
                          onClick={() => setCurrentImageIndex(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Metrics Grid */}
            {metrics && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <MetricCard icon={Mail} label="Enviados" value={delivered} />
                  <MetricCard icon={Eye} label="Aberturas" value={opens} />
                  <MetricCard
                    icon={TrendingUp}
                    label="Taxa Abertura"
                    value={metrics.open_rate?.toFixed(1)}
                    suffix="%"
                  />
                  <MetricCard
                    icon={MousePointer}
                    label="Taxa Clique"
                    value={metrics.click_rate?.toFixed(1)}
                    suffix="%"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <MetricCard icon={MousePointer} label="Cliques" value={clicks} />
                  <MetricCard icon={Users} label="Inscritos" value={metrics.subscribers} />
                  <MetricCard
                    icon={TrendingUp}
                    label="CTR"
                    value={
                      opens > 0 ? ((clicks / opens) * 100).toFixed(1) : null
                    }
                    suffix="%"
                  />
                </div>

                <Separator />
              </>
            )}

            {/* Content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Conteúdo</h4>
                {newsletter.content && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={copyContent}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copiar
                  </Button>
                )}
              </div>

              {newsletter.content ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{newsletter.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum conteúdo disponível. Clique em "Editar" para adicionar.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {newsletter.content_url && (
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <a
                    href={newsletter.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir Newsletter
                  </a>
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
