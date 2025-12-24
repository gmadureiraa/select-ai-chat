import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Save, MoreHorizontal, Settings, Trash2, Sparkles, LayoutTemplate, Play, ArrowLeft, Home } from "lucide-react";
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
import { WorkflowExecutionPanel } from "@/components/agent-builder/WorkflowExecutionPanel";
import { WorkflowRunsPanel } from "@/components/agent-builder/WorkflowRunsPanel";
import { WorkflowTemplateSelector } from "@/components/agent-builder/WorkflowTemplateSelector";
import { useAIWorkflows, useWorkflowNodes, useWorkflowConnections } from "@/hooks/useAIWorkflows";
import { useWorkflowTemplates, WorkflowTemplate } from "@/hooks/useWorkflowTemplates";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function AgentBuilder() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const { workflows, createWorkflow, updateWorkflow, deleteWorkflow } = useAIWorkflows();
  const { data: templates } = useWorkflowTemplates();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [isExecutionOpen, setIsExecutionOpen] = useState(false);

  const { nodes, isLoading: nodesLoading } = useWorkflowNodes(selectedWorkflowId);
  const { connections, isLoading: connectionsLoading } = useWorkflowConnections(selectedWorkflowId);

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId);

  // Convert nodes for execution panel
  const canvasNodes = nodes.map(n => ({
    id: n.id,
    type: n.type,
    data: {
      label: n.config?.name || n.type,
      config: n.config,
    },
  }));

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
        
      // Create workflow first
      const result = await createWorkflow.mutateAsync({
        name: template.name,
        description: template.description || "",
        is_active: false,
        trigger_config: { 
          type: triggerType,
          ...(template.workflow_config?.schedule && { schedule: template.workflow_config.schedule }),
        },
      });

      // Create a map from template node IDs to new node IDs
      const nodeIdMap: Record<string, string> = {};

      // Create nodes from template
      if (template.nodes && template.nodes.length > 0) {
        const { supabase } = await import("@/integrations/supabase/client");
        
        for (const templateNode of template.nodes) {
          const { data: newNode, error: nodeError } = await supabase
            .from("ai_workflow_nodes")
            .insert({
              workflow_id: result.id,
              type: templateNode.type,
              config: templateNode.config || {},
              position_x: templateNode.position?.x || 0,
              position_y: templateNode.position?.y || 0,
            })
            .select()
            .single();

          if (nodeError) {
            console.error("Error creating node:", nodeError);
            continue;
          }

          // Map template node ID to new node ID
          nodeIdMap[templateNode.id] = newNode.id;
        }

        // Create connections using the new node IDs
        if (template.connections && template.connections.length > 0) {
          for (const templateConnection of template.connections) {
            const sourceNodeId = nodeIdMap[templateConnection.source];
            const targetNodeId = nodeIdMap[templateConnection.target];

            if (sourceNodeId && targetNodeId) {
              await supabase
                .from("ai_workflow_connections")
                .insert({
                  workflow_id: result.id,
                  source_node_id: sourceNodeId,
                  target_node_id: targetNodeId,
                  connection_type: templateConnection.connection_type || "default",
                  label: templateConnection.label,
                });
            }
          }
        }
      }
      // Invalidate queries to refetch nodes and connections
      await queryClient.invalidateQueries({ queryKey: ["workflow-nodes", result.id] });
      await queryClient.invalidateQueries({ queryKey: ["workflow-connections", result.id] });
      
      setSelectedWorkflowId(result.id);
      setIsTemplateDialogOpen(false);
      toast.success(`Workflow "${template.name}" criado com ${template.nodes?.length || 0} nodes!`);
    } catch (error) {
      console.error("Error creating workflow from template:", error);
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

  const handleBack = () => {
    if (slug) {
      navigate(`/${slug}`);
    } else {
      navigate(-1);
    }
  };

  // If no workflow selected, show list
  if (!selectedWorkflowId) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-4 px-6">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="h-6 w-px bg-border" />
            <span className="font-semibold text-lg">Agent Builder</span>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <Home className="h-4 w-4" />
            </Button>
          </div>
        </header>
        
        <div className="container mx-auto py-8 px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-muted-foreground">Crie e gerencie workflows de agentes de IA</p>
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
            <ArrowLeft className="h-5 w-5" />
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
          <Button 
            size="sm"
            onClick={() => setIsExecutionOpen(true)}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Executar
          </Button>
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

      {/* Execution Panel */}
      <AnimatePresence>
        {isExecutionOpen && (
          <WorkflowExecutionPanel
            workflowId={selectedWorkflowId}
            workflowName={selectedWorkflow?.name || 'Workflow'}
            nodes={canvasNodes}
            onClose={() => setIsExecutionOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
