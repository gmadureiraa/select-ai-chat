import { useState } from "react";
import { ArrowLeft, Save, Play, Settings2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ImprovedAutomationBuilderCanvas } from "./ImprovedAutomationBuilderCanvas";
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
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "executions" | "evaluations">("editor");

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
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 gap-0 [&>button]:hidden">
        <div className="h-full flex flex-col bg-[#1a1a1a]">
          {/* Header - n8n style */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/50">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Personal</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">Automações</span>
                <span className="text-muted-foreground">/</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-7 w-auto min-w-[150px] border-none bg-transparent px-1 focus-visible:ring-0 font-medium"
                  placeholder="Nome da automação"
                />
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="h-8 bg-muted/50">
                  <TabsTrigger value="editor" className="text-xs h-6 px-3">
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="executions" className="text-xs h-6 px-3">
                    Executions
                  </TabsTrigger>
                  <TabsTrigger value="evaluations" className="text-xs h-6 px-3">
                    Evaluations
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Execution counter */}
              <span className="text-xs text-muted-foreground">0 / 2</span>

              {/* Active toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Active</span>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              {/* Share button */}
              <Button variant="outline" size="sm" className="h-8">
                Share
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1">
            <ImprovedAutomationBuilderCanvas
              initialFlow={initialFlow}
              onFlowChange={setCurrentFlow}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
