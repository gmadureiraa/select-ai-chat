import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain } from "lucide-react";

const MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Rápido e eficiente" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Mais poderoso" },
  { id: "openai/gpt-5-2025-08-07", name: "GPT-5", description: "OpenAI mais avançado" },
  { id: "openai/gpt-5-mini-2025-08-07", name: "GPT-5 Mini", description: "Balanceado" },
  { id: "openai/gpt-4.1-2025-04-14", name: "GPT-4.1", description: "Confiável e preciso" },
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Raciocínio superior" },
  { id: "anthropic/claude-opus-4-1-20250805", name: "Claude Opus 4.1", description: "Mais inteligente" },
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
