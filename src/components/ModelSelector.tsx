import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const MODELS = [
  // Modelos rápidos
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Balanceado e rápido", tier: "fast", icon: Zap },
  { id: "gemini-2.5-flash-lite", name: "Gemini Flash Lite", description: "Mais rápido e econômico", tier: "fast", icon: Zap },
  
  // Modelos de alta qualidade
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Máxima qualidade", tier: "quality", icon: Sparkles },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Mais inteligente (grátis)", tier: "quality", icon: Sparkles },
  
  // GPT-5 (via Lovable AI)
  { id: "openai/gpt-5", name: "GPT-5", description: "OpenAI mais potente", tier: "premium", icon: Brain },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", description: "OpenAI balanceado", tier: "premium", icon: Brain },
];

const TIER_COLORS = {
  fast: "text-green-500",
  quality: "text-blue-500",
  premium: "text-purple-500"
};

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const ModelSelector = ({ value, onChange }: ModelSelectorProps) => {
  const selectedModel = MODELS.find((m) => m.id === value) || MODELS[0];
  const Icon = selectedModel.icon;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[260px] border-border bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", TIER_COLORS[selectedModel.tier as keyof typeof TIER_COLORS])} />
          <SelectValue>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{selectedModel.name}</span>
            </div>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Rápidos</div>
        {MODELS.filter(m => m.tier === "fast").map((model) => {
          const ModelIcon = model.icon;
          return (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center gap-2">
                <ModelIcon className={cn("h-3.5 w-3.5", TIER_COLORS[model.tier])} />
                <div className="flex flex-col">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </div>
            </SelectItem>
          );
        })}
        
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Alta Qualidade</div>
        {MODELS.filter(m => m.tier === "quality").map((model) => {
          const ModelIcon = model.icon;
          return (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center gap-2">
                <ModelIcon className={cn("h-3.5 w-3.5", TIER_COLORS[model.tier])} />
                <div className="flex flex-col">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </div>
            </SelectItem>
          );
        })}
        
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Premium</div>
        {MODELS.filter(m => m.tier === "premium").map((model) => {
          const ModelIcon = model.icon;
          return (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center gap-2">
                <ModelIcon className={cn("h-3.5 w-3.5", TIER_COLORS[model.tier])} />
                <div className="flex flex-col">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
