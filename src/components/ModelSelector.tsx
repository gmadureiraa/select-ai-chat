import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain } from "lucide-react";

const MODELS = [
  { id: "gpt-5-2025-08-07", name: "GPT-5", description: "OpenAI mais avançado" },
  { id: "gpt-5-mini-2025-08-07", name: "GPT-5 Mini", description: "Balanceado" },
  { id: "gpt-4.1-2025-04-14", name: "GPT-4.1", description: "Confiável e preciso" },
  { id: "o3-2025-04-16", name: "O3", description: "Raciocínio profundo" },
  { id: "o4-mini-2025-04-16", name: "O4 Mini", description: "Raciocínio rápido" },
];

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const ModelSelector = ({ value, onChange }: ModelSelectorProps) => {
  const selectedModel = MODELS.find((m) => m.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] md:w-[200px] border-border h-9 text-sm">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <Brain className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary flex-shrink-0" />
          <SelectValue>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs md:text-sm font-medium truncate">{selectedModel?.name}</span>
              <span className="text-[10px] md:text-xs text-muted-foreground hidden sm:inline truncate">
                {selectedModel?.description}
              </span>
            </div>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent align="end" className="w-[200px] md:w-[240px]">
        {MODELS.map((model) => (
          <SelectItem key={model.id} value={model.id} className="cursor-pointer">
            <div className="flex flex-col py-1">
              <span className="font-medium text-sm">{model.name}</span>
              <span className="text-xs text-muted-foreground">{model.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};