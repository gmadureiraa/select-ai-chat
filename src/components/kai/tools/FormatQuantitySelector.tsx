import { 
  MessageSquare, 
  Mail, 
  FileText, 
  Linkedin, 
  Instagram, 
  Film, 
  Send,
  Scissors,
  BookOpen,
  Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContentFormat } from "@/hooks/useContentCreator";
import { FormatQuantity } from "@/hooks/useBulkContentCreator";

interface FormatOption {
  id: ContentFormat;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: "tweet", label: "Tweet", icon: Send, color: "text-sky-400", description: "Post curto" },
  { id: "thread", label: "Thread", icon: MessageSquare, color: "text-sky-500", description: "Série de tweets" },
  { id: "instagram_post", label: "Instagram", icon: Instagram, color: "text-pink-500", description: "Post com legenda" },
  { id: "reels_script", label: "Reels", icon: Film, color: "text-rose-500", description: "Roteiro curto" },
  { id: "carousel", label: "Carrossel", icon: Film, color: "text-purple-500", description: "Slides visuais" },
  { id: "linkedin_post", label: "LinkedIn", icon: Linkedin, color: "text-blue-600", description: "Post profissional" },
  { id: "newsletter", label: "Newsletter", icon: Mail, color: "text-blue-500", description: "Email longo" },
  { id: "blog_post", label: "Blog", icon: FileText, color: "text-emerald-500", description: "Artigo completo" },
  { id: "email_marketing", label: "Email Mkt", icon: Megaphone, color: "text-amber-500", description: "Email de conversão" },
  { id: "cut_moments", label: "Cortes", icon: Scissors, color: "text-red-500", description: "Clips virais" },
];

const QUANTITY_OPTIONS = [0, 1, 2, 3, 5, 10];

interface FormatPackage {
  id: string;
  name: string;
  description: string;
  formats: { format: ContentFormat; quantity: number }[];
}

const FORMAT_PACKAGES: FormatPackage[] = [
  {
    id: "instagram_completo",
    name: "Pack Instagram",
    description: "5 posts + 3 carrosséis + 2 reels",
    formats: [
      { format: "instagram_post", quantity: 5 },
      { format: "carousel", quantity: 3 },
      { format: "reels_script", quantity: 2 },
    ],
  },
  {
    id: "multicanal",
    name: "Multicanal",
    description: "3 IG + 3 LinkedIn + 5 tweets",
    formats: [
      { format: "instagram_post", quantity: 3 },
      { format: "linkedin_post", quantity: 3 },
      { format: "tweet", quantity: 5 },
    ],
  },
  {
    id: "newsletter_pack",
    name: "Newsletter+",
    description: "1 newsletter + 5 tweets + 3 posts",
    formats: [
      { format: "newsletter", quantity: 1 },
      { format: "tweet", quantity: 5 },
      { format: "instagram_post", quantity: 3 },
    ],
  },
  {
    id: "lancamento",
    name: "Lançamento",
    description: "Blog + Newsletter + Redes",
    formats: [
      { format: "blog_post", quantity: 1 },
      { format: "newsletter", quantity: 1 },
      { format: "instagram_post", quantity: 3 },
      { format: "linkedin_post", quantity: 2 },
      { format: "thread", quantity: 1 },
    ],
  },
];

interface FormatQuantitySelectorProps {
  formatQuantities: FormatQuantity[];
  onUpdateQuantity: (format: ContentFormat, quantity: number) => void;
  onApplyPackage?: (formats: { format: ContentFormat; quantity: number }[]) => void;
  disabled?: boolean;
}

export function FormatQuantitySelector({
  formatQuantities,
  onUpdateQuantity,
  onApplyPackage,
  disabled,
}: FormatQuantitySelectorProps) {
  const getQuantity = (format: ContentFormat) => {
    return formatQuantities.find(fq => fq.format === format)?.quantity || 0;
  };

  return (
    <div className="space-y-4">
      {/* Quick Packages */}
      {onApplyPackage && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">📦 Pacotes rápidos</p>
          <div className="flex flex-wrap gap-2">
            {FORMAT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => onApplyPackage(pkg.formats)}
                disabled={disabled}
                className={cn(
                  "px-3 py-1.5 rounded-full border border-border text-sm",
                  "hover:border-primary hover:bg-primary/5 transition-all",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span className="font-medium">{pkg.name}</span>
                <span className="text-muted-foreground ml-1 text-xs">({pkg.description})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Individual Formats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {FORMAT_OPTIONS.map((format) => {
          const Icon = format.icon;
          const quantity = getQuantity(format.id);
          const isActive = quantity > 0;

          return (
            <div
              key={format.id}
              className={cn(
                "relative rounded-xl border-2 p-3 transition-all",
                isActive 
                  ? "border-primary bg-primary/5 shadow-sm" 
                  : "border-muted hover:border-muted-foreground/30",
                disabled && "opacity-50 pointer-events-none"
              )}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-4 w-4", format.color)} />
                <span className="text-sm font-medium truncate">{format.label}</span>
              </div>

              {/* Quantity Selector */}
              <div className="flex flex-wrap gap-1">
                {QUANTITY_OPTIONS.map((qty) => (
                  <Button
                    key={qty}
                    variant={quantity === qty ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 w-7 p-0 text-xs",
                      quantity === qty && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => onUpdateQuantity(format.id, qty)}
                    disabled={disabled}
                  >
                    {qty}
                  </Button>
                ))}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">{quantity}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
