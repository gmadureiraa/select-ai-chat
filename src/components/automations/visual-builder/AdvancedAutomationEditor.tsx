import { useState } from "react";
import { ArrowLeft, Save, Play, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ImprovedAutomationBuilderCanvas } from "./ImprovedAutomationBuilderCanvas";
import { WorkflowExecutionsPanel } from "./WorkflowExecutionsPanel";
import type { AutomationFlow } from "@/types/automationBuilder";
import { toast } from "sonner";

interface AdvancedAutomationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationName?: string;
  automationId?: string;
  n8nWorkflowId?: string;
  initialFlow?: AutomationFlow;
  onSave: (flow: AutomationFlow, name: string) => void;
}

export const AdvancedAutomationEditor = ({
  open,
  onOpenChange,
  automationName = "Nova Automação",
  automationId,
  n8nWorkflowId,
  initialFlow,
  onSave,
}: AdvancedAutomationEditorProps) => {
  const [name, setName] = useState(automationName);
  const [currentFlow, setCurrentFlow] = useState<AutomationFlow>(
    initialFlow || { nodes: [], connections: [] }
  );
  const [isActive, setIsActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "executions" | "evaluations">("editor");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome da automação é obrigatório");
      return;
    }
    
    if (currentFlow.nodes.length === 0) {
      toast.error("Adicione pelo menos um node ao fluxo");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(currentFlow, name);
      toast.success("Automação salva com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar automação");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = () => {
    toast.info("Iniciando teste do workflow...");
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
                <span className="text-muted-foreground">Automações</span>
                <span className="text-muted-foreground">/</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-7 w-auto min-w-[150px] border-none bg-transparent px-1 focus-visible:ring-0 font-medium"
                  placeholder="Nome da automação"
                />
                {automationId && (
                  <Badge variant="secondary" className="text-xs">
                    Editando
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
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

              {/* Active toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Active</span>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={handleTest}
                >
                  <Play className="mr-1 h-3 w-3" />
                  Test
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                >
                  <Share2 className="mr-1 h-3 w-3" />
                  Share
                </Button>
                <Button 
                  size="sm" 
                  className="h-8"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="mr-1 h-3 w-3" />
                  {isSaving ? "Salvando..." : "Save"}
                </Button>
              </div>
            </div>
          </div>

          {/* Content based on active tab */}
          <div className="flex-1">
            {activeTab === "editor" && (
              <ImprovedAutomationBuilderCanvas
                initialFlow={initialFlow}
                onFlowChange={setCurrentFlow}
              />
            )}
            
            {activeTab === "executions" && (
              <WorkflowExecutionsPanel
                workflowId={n8nWorkflowId}
                workflowName={name}
              />
            )}
            
            {activeTab === "evaluations" && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-medium">Evaluations</p>
                  <p className="text-sm">Métricas e avaliações do workflow em breve</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
