import { useState, useEffect } from "react";
import { Zap, Plus, Play, Clock, CheckCircle2, Workflow, ExternalLink, Settings2, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAutomations } from "@/hooks/useAutomations";
import { useN8nMCP, N8nWorkflow } from "@/hooks/useN8nMCP";
import { AutomationDialog } from "@/components/automations/AutomationDialog";
import { Client } from "@/hooks/useClients";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface KaiAutomationsTabProps {
  clientId: string;
  client: Client;
}

export const KaiAutomationsTab = ({ clientId, client }: KaiAutomationsTabProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [addWorkflowOpen, setAddWorkflowOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ id: "", name: "", webhookUrl: "" });

  const { 
    automations, 
    updateAutomation, 
    runAutomation 
  } = useAutomations();

  const {
    workflows,
    isLoading: isLoadingWorkflows,
    isExecuting,
    fetchWorkflows,
    addWorkflow,
    removeWorkflow,
    executeWorkflow,
    updateWorkflowWebhook,
    getWorkflowWebhook,
  } = useN8nMCP();

  // Fetch workflows on mount
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Filter automations for this client (or all if no client)
  const clientAutomations = clientId 
    ? automations?.filter(a => a.client_id === clientId) || []
    : automations || [];
  const activeCount = clientAutomations.filter(a => a.is_active).length;

  const handleToggleActive = (automation: any) => {
    updateAutomation.mutate({
      id: automation.id,
      is_active: !automation.is_active,
    });
  };

  const handleRun = (automation: any) => {
    runAutomation.mutate(automation.id);
  };

  const handleAddWorkflow = () => {
    if (newWorkflow.id && newWorkflow.name) {
      addWorkflow({
        id: newWorkflow.id,
        name: newWorkflow.name,
        active: true,
        triggerType: "webhook",
      });
      if (newWorkflow.webhookUrl) {
        updateWorkflowWebhook(newWorkflow.id, newWorkflow.webhookUrl);
      }
      setNewWorkflow({ id: "", name: "", webhookUrl: "" });
      setAddWorkflowOpen(false);
    }
  };

  const handleExecuteWorkflow = async (workflow: N8nWorkflow) => {
    const webhookUrl = getWorkflowWebhook(workflow.id);
    if (webhookUrl) {
      await executeWorkflow(webhookUrl, { 
        clientId, 
        clientName: client?.name,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Automações</h2>
          </div>
          <Badge variant="secondary">
            {activeCount} ativas
          </Badge>
        </div>
        
        <Button onClick={() => {
          setSelectedAutomation(null);
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Automação
        </Button>
      </div>

      <Tabs defaultValue="automations" className="w-full">
        <TabsList>
          <TabsTrigger value="automations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="n8n" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows n8n
          </TabsTrigger>
        </TabsList>

        {/* Automations Tab */}
        <TabsContent value="automations" className="mt-4">
          {clientAutomations.length === 0 ? (
            <Card className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">Nenhuma automação configurada</p>
                <p className="text-sm mb-4">
                  Crie automações com gatilhos RSS, IA e publicação automática
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedAutomation(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Automação
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {clientAutomations.map((automation) => (
                <Card key={automation.id} className="overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={() => handleToggleActive(automation)}
                      />
                      <div>
                        <h3 className="font-medium">{automation.name}</h3>
                        {automation.description && (
                          <p className="text-sm text-muted-foreground">
                            {automation.description}
                          </p>
                        )}
                        {/* Show data sources */}
                        {automation.data_sources && (automation.data_sources as any[]).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {(automation.data_sources as any[]).map((ds: any) => (
                              <Badge key={ds.id} variant="outline" className="text-xs">
                                {ds.type.toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Schedule Info */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {automation.schedule_type === "daily" && "Diário"}
                          {automation.schedule_type === "weekly" && "Semanal"}
                          {automation.schedule_type === "monthly" && "Mensal"}
                          {automation.schedule_time && ` às ${automation.schedule_time}`}
                        </span>
                      </div>

                      {/* Last Run */}
                      {automation.last_run_at && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span>
                            {format(new Date(automation.last_run_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRun(automation)}
                          disabled={runAutomation.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Executar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAutomation(automation);
                            setDialogOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* n8n Workflows Tab */}
        <TabsContent value="n8n" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Workflows do n8n conectados via MCP
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={isLoadingWorkflows}>
                <RefreshCw className={cn("h-4 w-4 mr-1", isLoadingWorkflows && "animate-spin")} />
                Atualizar
              </Button>
              <Dialog open={addWorkflowOpen} onOpenChange={setAddWorkflowOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Workflow n8n</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>ID do Workflow</Label>
                      <Input
                        placeholder="Ex: c7szXhtpjXUqaRKK"
                        value={newWorkflow.id}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Nome</Label>
                      <Input
                        placeholder="Nome do workflow"
                        value={newWorkflow.name}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Webhook URL</Label>
                      <Input
                        placeholder="https://n8n.example.com/webhook/..."
                        value={newWorkflow.webhookUrl}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, webhookUrl: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        URL do webhook de produção do workflow
                      </p>
                    </div>
                    <Button onClick={handleAddWorkflow} className="w-full">
                      Adicionar Workflow
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {workflows.length === 0 ? (
            <Card className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">Nenhum workflow configurado</p>
                <p className="text-sm mb-4">
                  Adicione workflows do n8n para executar automaticamente
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {workflows.map((workflow) => {
                const webhookUrl = getWorkflowWebhook(workflow.id);
                return (
                  <Card key={workflow.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Workflow className="h-5 w-5 text-orange-500" />
                          <CardTitle className="text-base">{workflow.name}</CardTitle>
                          <Badge variant={workflow.active ? "default" : "secondary"}>
                            {workflow.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExecuteWorkflow(workflow)}
                            disabled={isExecuting || !webhookUrl}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Executar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeWorkflow(workflow.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {workflow.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Settings2 className="h-3 w-3" />
                          ID: {workflow.id}
                        </span>
                        {workflow.triggerType && (
                          <Badge variant="outline" className="text-xs">
                            {workflow.triggerType}
                          </Badge>
                        )}
                        {webhookUrl ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Webhook configurado
                          </span>
                        ) : (
                          <span className="text-yellow-600">
                            Webhook não configurado
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Automation Dialog */}
      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={selectedAutomation}
      />
    </div>
  );
};
