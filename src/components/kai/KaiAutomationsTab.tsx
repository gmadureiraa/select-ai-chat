import { useState, useEffect, useMemo } from "react";
import { Zap, Plus, Play, Clock, CheckCircle2, Workflow, RefreshCw, Trash2, Edit, Filter, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutomations } from "@/hooks/useAutomations";
import { useN8nMCP, N8nWorkflow } from "@/hooks/useN8nMCP";
import { AutomationDialog } from "@/components/automations/AutomationDialog";
import { AutomationStatsOverview } from "@/components/automations/AutomationStatsOverview";
import { Client } from "@/hooks/useClients";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface KaiAutomationsTabProps {
  clientId: string;
  client: Client;
}

export const KaiAutomationsTab = ({ clientId, client }: KaiAutomationsTabProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [addWorkflowOpen, setAddWorkflowOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ id: "", name: "", webhookUrl: "" });
  const [filterClientId, setFilterClientId] = useState<string>("all");

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

  // Fetch all clients for filter
  const { data: allClients } = useQuery({
    queryKey: ["clients-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch automation runs for stats
  const { data: automationRuns } = useQuery({
    queryKey: ["automation-runs-stats"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from("automation_runs")
        .select("*")
        .gte("started_at", sevenDaysAgo.toISOString());
      
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!automationRuns) {
      return {
        totalExecutions: 0,
        failedExecutions: 0,
        failureRate: 0,
        avgRunTime: 0,
      };
    }

    const total = automationRuns.length;
    const failed = automationRuns.filter((r) => r.status === "failed").length;
    const avgTime = automationRuns.reduce((acc, r) => acc + (r.duration_ms || 0), 0) / (total || 1) / 1000;

    return {
      totalExecutions: total,
      failedExecutions: failed,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      avgRunTime: avgTime,
    };
  }, [automationRuns]);

  // Fetch workflows on mount
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Filter automations
  const filteredAutomations = useMemo(() => {
    let result = automations || [];
    
    if (filterClientId !== "all") {
      result = result.filter((a) => a.client_id === filterClientId);
    } else if (clientId) {
      // If on a specific client page, default to that client
      result = result.filter((a) => a.client_id === clientId);
    }
    
    return result;
  }, [automations, filterClientId, clientId]);

  // Sort: errors first
  const sortedAutomations = useMemo(() => {
    return [...filteredAutomations].sort((a, b) => {
      // Check if automation has recent error
      const aHasError = automationRuns?.some(
        (r) => r.automation_id === a.id && r.status === "failed"
      );
      const bHasError = automationRuns?.some(
        (r) => r.automation_id === b.id && r.status === "failed"
      );
      
      if (aHasError && !bHasError) return -1;
      if (!aHasError && bHasError) return 1;
      return 0;
    });
  }, [filteredAutomations, automationRuns]);

  const activeCount = filteredAutomations.filter((a) => a.is_active).length;

  const handleToggleActive = (automation: any) => {
    updateAutomation.mutate({
      id: automation.id,
      is_active: !automation.is_active,
    });
  };

  const handleRun = (automation: any) => {
    runAutomation.mutate(automation.id);
  };

  const handleEdit = (automation: any) => {
    setSelectedAutomation(automation);
    setDialogOpen(true);
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

  const getLastRunError = (automationId: string) => {
    const runs = automationRuns?.filter((r) => r.automation_id === automationId) || [];
    const lastRun = runs.sort((a, b) => 
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0];
    
    if (lastRun?.status === "failed") {
      return lastRun.error;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <AutomationStatsOverview
        totalExecutions={stats.totalExecutions}
        failedExecutions={stats.failedExecutions}
        failureRate={stats.failureRate}
        avgRunTime={stats.avgRunTime}
        executionsChange={-1.43}
        failedChange={4.76}
        failureRateChange={1.9}
        runTimeChange={-5.25}
      />

      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Overview</h2>
          </div>
          <Badge variant="secondary">
            {activeCount} ativas
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Client Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterClientId} onValueChange={setFilterClientId}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {allClients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => {
            setSelectedAutomation(null);
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Create workflow
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        All the workflows, credentials and data tables you have access to
      </p>

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
          {sortedAutomations.length === 0 ? (
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
              {sortedAutomations.map((automation) => {
                const lastError = getLastRunError(automation.id);
                const clientName = allClients?.find((c) => c.id === automation.client_id)?.name;
                
                return (
                  <Card 
                    key={automation.id} 
                    className={cn(
                      "overflow-hidden",
                      lastError && "border-destructive/50"
                    )}
                  >
                    {/* Error Banner */}
                    {lastError && (
                      <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive font-medium">Último erro:</span>
                        <span className="text-sm text-destructive/80 truncate">{lastError}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={() => handleToggleActive(automation)}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{automation.name}</h3>
                            {clientName && (
                              <Badge variant="outline" className="text-xs">
                                {clientName}
                              </Badge>
                            )}
                          </div>
                          {automation.description && (
                            <p className="text-sm text-muted-foreground">
                              {automation.description}
                            </p>
                          )}
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {automation.schedule_type === "daily" && "Diário"}
                            {automation.schedule_type === "weekly" && "Semanal"}
                            {automation.schedule_type === "monthly" && "Mensal"}
                            {automation.schedule_time && ` às ${automation.schedule_time}`}
                          </span>
                        </div>

                        {automation.last_run_at && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>
                              {format(new Date(automation.last_run_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        )}

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
                            onClick={() => handleEdit(automation)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
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
