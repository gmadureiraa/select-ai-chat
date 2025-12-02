import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain } from "lucide-react";

const MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Balanceado e rápido (recomendado)" },
  { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash 8B", description: "Mais rápido e econômico" },
  { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp", description: "Experimental grátis" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Máxima qualidade" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Versão estável anterior" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Pro anterior" },
];

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const ModelSelector = ({ value, onChange }: ModelSelectorProps) => {
  const selectedModel = MODELS.find((m) => m.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[280px] border-border">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <SelectValue>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{selectedModel?.name}</span>
              <span className="text-xs text-muted-foreground">{selectedModel?.description}</span>
            </div>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <div className="flex flex-col">
              <span className="font-medium">{model.name}</span>
              <span className="text-xs text-muted-foreground">{model.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
