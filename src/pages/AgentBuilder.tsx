import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Save, ChevronLeft, MoreHorizontal, Settings, Trash2, Sparkles, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentBuilderCanvas } from "@/components/agent-builder/AgentBuilderCanvas";
import { WorkflowTestPanel } from "@/components/agent-builder/WorkflowTestPanel";
import { WorkflowRunsPanel } from "@/components/agent-builder/WorkflowRunsPanel";
import { WorkflowTemplateSelector } from "@/components/agent-builder/WorkflowTemplateSelector";
import { useAIWorkflows, useWorkflowNodes, useWorkflowConnections } from "@/hooks/useAIWorkflows";
import { useWorkflowTemplates, WorkflowTemplate } from "@/hooks/useWorkflowTemplates";
import { toast } from "sonner";

export default function AgentBuilder() {
  const navigate = useNavigate();
  const { workflows, createWorkflow, updateWorkflow, deleteWorkflow } = useAIWorkflows();
  const { data: templates } = useWorkflowTemplates();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");

  const { nodes } = useWorkflowNodes(selectedWorkflowId);
  const { connections } = useWorkflowConnections(selectedWorkflowId);

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    const result = await createWorkflow.mutateAsync({
      name: newWorkflowName,
      description: "",
      is_active: false,
      trigger_config: { type: "manual" },
    });
    
    setSelectedWorkflowId(result.id);
    setIsCreateDialogOpen(false);
    setNewWorkflowName("");
  };

  const handleCreateFromTemplate = async (template: WorkflowTemplate) => {
    try {
      const triggerType = (template.workflow_config?.trigger_type || "manual") as "manual" | "webhook" | "schedule" | "user_message" | "event";
        
      const result = await createWorkflow.mutateAsync({
        name: template.name,
        description: template.description || "",
        is_active: false,
        trigger_config: { type: triggerType },
      });
      
      setSelectedWorkflowId(result.id);
      setIsTemplateDialogOpen(false);
      toast.success(`Workflow "${template.name}" criado a partir do template!`);
    } catch (error) {
      toast.error("Erro ao criar workflow");
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    await deleteWorkflow.mutateAsync(id);
    if (selectedWorkflowId === id) {
      setSelectedWorkflowId(null);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateWorkflow.mutateAsync({ id, is_active: !isActive });
  };

  // If no workflow selected, show list
  if (!selectedWorkflowId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/agents")}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Agent Builder</h1>
                <p className="text-muted-foreground">Crie e gerencie workflows de agentes de IA</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsTemplateDialogOpen(true)}>
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Usar Template
              </Button>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Workflow
              </Button>
            </div>
          </div>

          {workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-primary/10 p-6 mb-4">
                <Settings className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Nenhum workflow criado</h2>
              <p className="text-muted-foreground mb-4 max-w-md">
                Crie seu primeiro workflow para começar a orquestrar agentes de IA em fluxos visuais.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Workflow
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="group relative rounded-xl border border-border bg-card p-6 hover:border-primary/50 transition-all cursor-pointer"
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{workflow.name}</h3>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(workflow.id, workflow.is_active);
                        }}>
                          {workflow.is_active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkflow(workflow.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={workflow.is_active ? "default" : "secondary"}>
                      {workflow.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(workflow.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Workflow</DialogTitle>
              <DialogDescription>
                Crie um novo workflow para orquestrar agentes de IA
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Nome do workflow"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateWorkflow()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateWorkflow} disabled={createWorkflow.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Template Selector */}
        <WorkflowTemplateSelector
          open={isTemplateDialogOpen}
          onOpenChange={setIsTemplateDialogOpen}
          onSelectTemplate={handleCreateFromTemplate}
        />
      </div>
    );
  }

  // Show canvas for selected workflow
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedWorkflowId(null)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <Input
              value={selectedWorkflow?.name || ""}
              onChange={(e) => updateWorkflow.mutate({ id: selectedWorkflowId!, name: e.target.value })}
              className="h-8 font-semibold border-none bg-transparent px-0 focus-visible:ring-0"
            />
          </div>
          <Badge variant={selectedWorkflow?.is_active ? "default" : "secondary"}>
            {selectedWorkflow?.is_active ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <WorkflowRunsPanel workflowId={selectedWorkflowId} />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              updateWorkflow.mutate({ id: selectedWorkflowId!, name: selectedWorkflow?.name || '' });
              toast.success('Workflow salvo!');
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          <WorkflowTestPanel 
            workflowId={selectedWorkflowId} 
            workflowName={selectedWorkflow?.name || 'Workflow'} 
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <AgentBuilderCanvas
          workflowId={selectedWorkflowId}
          initialNodes={nodes}
          initialConnections={connections}
        />
      </div>
    </div>
  );
}
