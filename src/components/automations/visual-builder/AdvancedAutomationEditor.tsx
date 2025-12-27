import { useState } from "react";
import { ArrowLeft, Save, Play, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { AutomationBuilderCanvas } from "./AutomationBuilderCanvas";
import type { AutomationFlow } from "@/types/automationBuilder";
import { toast } from "sonner";

interface AdvancedAutomationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationName?: string;
  initialFlow?: AutomationFlow;
  onSave: (flow: AutomationFlow, name: string) => void;
}

export const AdvancedAutomationEditor = ({
  open,
  onOpenChange,
  automationName = "Nova Automação",
  initialFlow,
  onSave,
}: AdvancedAutomationEditorProps) => {
  const [name, setName] = useState(automationName);
  const [currentFlow, setCurrentFlow] = useState<AutomationFlow>(
    initialFlow || { nodes: [], connections: [] }
  );

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Nome da automação é obrigatório");
      return;
    }
    
    if (currentFlow.nodes.length === 0) {
      toast.error("Adicione pelo menos um node ao fluxo");
      return;
    }

    onSave(currentFlow, name);
    toast.success("Automação salva com sucesso!");
    onOpenChange(false);
  };

  const handleTest = () => {
    toast.info("Funcionalidade de teste em desenvolvimento");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 gap-0">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 font-semibold border-none bg-transparent px-0 focus-visible:ring-0 text-lg"
                  placeholder="Nome da automação"
                />
                <Badge variant="secondary">
                  <Settings2 className="h-3 w-3 mr-1" />
                  Edição Avançada
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTest}>
                <Play className="h-4 w-4 mr-2" />
                Testar
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1">
            <AutomationBuilderCanvas
              initialFlow={initialFlow}
              onFlowChange={setCurrentFlow}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
