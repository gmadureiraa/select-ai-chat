import { useState, useEffect, useMemo } from "react";
import { Zap, Plus, Play, Clock, CheckCircle2, Workflow, RefreshCw, Trash2, Edit, Filter, AlertCircle, Lock, Settings, MessageCircle } from "lucide-react";
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
import { useN8nWorkflows, useN8nExecutions } from "@/hooks/useN8nAPI";
import { useWorkspaceN8nCredentials } from "@/hooks/useWorkspaceN8nCredentials";
import { AutomationDialog } from "@/components/automations/AutomationDialog";
import { AutomationStatsOverview } from "@/components/automations/AutomationStatsOverview";
import { N8nWorkflowsManager } from "@/components/n8n/N8nWorkflowsManager";
import { N8nSetupDialog } from "@/components/n8n/N8nSetupDialog";
import { Client } from "@/hooks/useClients";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1%21+Tenho+interesse+no+plano+Enterprise+do+KAI.&type=phone_number&app_absent=0";

interface KaiAutomationsTabProps {
  clientId: string;
  client: Client;
}

export const KaiAutomationsTab = ({ clientId, client }: KaiAutomationsTabProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const [addWorkflowOpen, setAddWorkflowOpen] = useState(false);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ id: "", name: "", webhookUrl: "" });
  const [filterClientId, setFilterClientId] = useState<string>("all");

  const { isEnterprise, isLoading: planLoading } = usePlanFeatures();
  const { 
    credentials, 
    isLoading: credentialsLoading, 
    isConfigured, 
    saveCredentials 
  } = useWorkspaceN8nCredentials();

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

  // Fetch real n8n workflows and executions (only if configured)
  const { data: n8nWorkflows, isLoading: n8nWorkflowsLoading, error: n8nError } = useN8nWorkflows();
  const { data: n8nExecutions, isLoading: n8nExecutionsLoading } = useN8nExecutions();

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

  // Check if n8n is not configured
  const n8nNotConfigured = n8nError?.message === 'N8N_NOT_CONFIGURED' || !isConfigured;

  // Calculate stats from real n8n executions
  const stats = useMemo(() => {
    if (!n8nExecutions || n8nExecutions.length === 0 || n8nNotConfigured) {
      return {
        totalExecutions: 0,
        failedExecutions: 0,
        failureRate: 0,
        avgRunTime: 0,
        successExecutions: 0,
      };
    }

    // Filter last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentExecutions = n8nExecutions.filter((e) => {
      const startDate = e.startedAt ? new Date(e.startedAt) : null;
      const stopDate = e.stoppedAt ? new Date(e.stoppedAt) : null;
      const execDate = startDate || stopDate;
      return execDate && execDate >= sevenDaysAgo;
    });

    const total = recentExecutions.length;
    const failed = recentExecutions.filter((e) => e.status === "error").length;
    const success = recentExecutions.filter((e) => e.status === "success").length;
    
    const executionsWithTime = recentExecutions.filter((e) => e.startedAt && e.stoppedAt);
    const avgTime = executionsWithTime.length > 0 
      ? executionsWithTime.reduce((acc, e) => {
          const start = new Date(e.startedAt).getTime();
          const stop = new Date(e.stoppedAt!).getTime();
          return acc + (stop - start);
        }, 0) / executionsWithTime.length / 1000
      : 0;

    return {
      totalExecutions: total,
      failedExecutions: failed,
      successExecutions: success,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      avgRunTime: avgTime,
    };
  }, [n8nExecutions, n8nNotConfigured]);

  // Calculate active n8n workflows count
  const activeN8nCount = useMemo(() => {
    if (n8nNotConfigured) return 0;
    return n8nWorkflows?.filter((w) => w.active).length || 0;
  }, [n8nWorkflows, n8nNotConfigured]);

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
      result = result.filter((a) => a.client_id === clientId);
    }
    
    return result;
  }, [automations, filterClientId, clientId]);

  // Sort automations by most recent activity
  const sortedAutomations = useMemo(() => {
    return [...filteredAutomations].sort((a, b) => {
      const aDate = a.last_run_at ? new Date(a.last_run_at) : new Date(a.updated_at);
      const bDate = b.last_run_at ? new Date(b.last_run_at) : new Date(b.updated_at);
      return bDate.getTime() - aDate.getTime();
    });
  }, [filteredAutomations]);

  const activeCount = activeN8nCount;

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

  const handleSaveCredentials = async (apiUrl: string, apiKey: string) => {
    await saveCredentials.mutateAsync({ apiUrl, apiKey });
  };

  // Enterprise restriction check - show lock screen with contact option
  if (!planLoading && !isEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Recurso Enterprise</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Automações e workflows n8n estão disponíveis apenas no plano Enterprise. 
          Entre em contato para fazer upgrade e desbloquear esta funcionalidade.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com Vendas
            </a>
          </Button>
        </div>
        <Badge variant="outline" className="text-xs mt-4">
          Plano Enterprise necessário
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview - Real n8n data */}
      <AutomationStatsOverview
        totalExecutions={stats.totalExecutions}
        failedExecutions={stats.failedExecutions}
        failureRate={stats.failureRate}
        avgRunTime={stats.avgRunTime}
        successExecutions={stats.successExecutions}
      />

      {/* n8n Connection Status */}
      {n8nNotConfigured && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Conectar n8n</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Configure as credenciais da API do seu n8n para sincronizar seus workflows e visualizar execuções.
            </p>
            <Button onClick={() => setSetupDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar n8n
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Workflows n8n</h2>
          </div>
          <Badge variant="secondary">
            {activeCount} ativas
          </Badge>
          {n8nWorkflowsLoading && (
            <Badge variant="outline" className="text-xs">
              Carregando...
            </Badge>
          )}
          {isConfigured && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSetupDialogOpen(true)}
              className="text-muted-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
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

      <Tabs defaultValue="n8n" className="w-full">
        <TabsList>
          <TabsTrigger value="n8n" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows n8n
          </TabsTrigger>
          <TabsTrigger value="automations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automações Locais
          </TabsTrigger>
        </TabsList>

        {/* n8n Workflows Tab */}
        <TabsContent value="n8n" className="mt-4">
          {n8nNotConfigured ? (
            <Card className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">n8n não configurado</p>
                <p className="text-sm mb-4">
                  Configure as credenciais do n8n para ver seus workflows aqui
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSetupDialogOpen(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar n8n
                </Button>
              </div>
            </Card>
          ) : (
            <N8nWorkflowsManager />
          )}
        </TabsContent>

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
                const clientName = allClients?.find((c) => c.id === automation.client_id)?.name;
                
                return (
                  <Card 
                    key={automation.id} 
                    className="overflow-hidden"
                  >
                    
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
      </Tabs>

      {/* Automation Dialog */}
      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={selectedAutomation}
      />

      {/* n8n Setup Dialog */}
      <N8nSetupDialog
        open={setupDialogOpen}
        onOpenChange={setSetupDialogOpen}
        onSave={handleSaveCredentials}
        isLoading={saveCredentials.isPending}
        existingUrl={credentials?.n8n_api_url}
      />
    </div>
  );
};